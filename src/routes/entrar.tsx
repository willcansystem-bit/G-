import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { consumeIntent, useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/giro/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/entrar")({ component: Login });

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A6 6 0 0 1 12 5.96Z"
      />
    </svg>
  );
}

function Login() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const attempted = useRef(false);
  const launching = useRef(false);
  const finish = useCallback(async () => {
    attempted.current = true;
    const channelId = sessionStorage.getItem("giro:follow");
    const {
      data: { user: currentUser },
      error: sessionError,
    } = await supabase.auth.getUser();
    if (sessionError || !currentUser)
      throw new Error(
        "Não foi possível confirmar sua sessão. Tente entrar novamente com o Google.",
      );
    if (channelId) {
      const { error } = await supabase
        .from("channel_follows")
        .upsert(
          { user_id: currentUser.id, channel_id: channelId },
          { onConflict: "user_id,channel_id", ignoreDuplicates: true },
        );
      if (error)
        throw new Error(
          "Sua conta está conectada, mas não foi possível seguir o canal. Tente continuar novamente.",
        );
      sessionStorage.removeItem("giro:follow");
    }
    await cache.invalidateQueries({ queryKey: ["me"] });
    await navigate({ to: consumeIntent() ?? "/" });
  }, [cache, navigate]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("error") || fragment.has("error")) {
      setNotice("A entrada com Google foi cancelada ou não pôde ser concluída. Tente novamente.");
      const cleaned = new URL(window.location.href);
      for (const key of ["error", "error_code", "error_description"])
        cleaned.searchParams.delete(key);
      if (fragment.has("error")) cleaned.hash = "";
      window.history.replaceState(window.history.state, "", cleaned);
    }
  }, []);

  useEffect(() => {
    if (!user || loading || launching.current || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    finish()
      .catch((error) =>
        setNotice(error instanceof Error ? error.message : "Não foi possível continuar."),
      )
      .finally(() => setBusy(false));
  }, [user, loading, finish]);

  async function signIn() {
    if (launching.current) return;
    launching.current = true;
    setBusy(true);
    setNotice("");
    try {
      if (user) {
        await finish();
        setBusy(false);
        return;
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/entrar`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !data.url)
        throw new Error("Não foi possível iniciar a entrada com Google. Tente novamente.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível entrar com Google.");
      setBusy(false);
    } finally {
      launching.current = false;
    }
  }

  return (
    <>
      <PageHeader title="Entrar" />
      <section className="px-5 py-10 sm:px-8">
        <div className="space-y-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Seu giro começa com você.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Entre com sua conta Google para seguir canais, salvar notícias e participar das
              conversas.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy || loading}
            aria-busy={busy || loading}
            onClick={signIn}
            className="h-12 w-full rounded-full bg-white text-base font-semibold text-slate-900 hover:bg-slate-100 hover:text-slate-900"
          >
            {busy || loading ? (
              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleMark />
            )}
            {loading
              ? "Verificando sua sessão…"
              : busy
                ? "Aguarde…"
                : user
                  ? "Continuar"
                  : "Continuar com Google"}
          </Button>
          {notice && (
            <p role="alert" className="rounded-2xl border border-border bg-secondary p-3 text-sm">
              {notice}
            </p>
          )}
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            No primeiro acesso, sua conta é criada automaticamente. A entrada é feita somente pelo
            Google.
          </p>
        </div>
      </section>
    </>
  );
}
