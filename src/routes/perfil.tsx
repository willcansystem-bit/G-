import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth, useMyState } from "@/hooks/useAuth";
import { community, type Profile } from "@/lib/community";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/giro/AppShell";
import { Access } from "@/components/giro/Access";
import { UserAvatar } from "@/components/giro/UserAvatar";
import { AvatarEditor } from "@/components/giro/AvatarEditor";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/perfil")({
  component: () => (
    <>
      <PageHeader title="Perfil" />
      <Access>
        <ProfilePage />
      </Access>
    </>
  ),
});
function ProfilePage() {
  const me = useMyState();
  if (me.isPending) return <p className="p-6">Carregando perfil…</p>;
  if (me.isError || !me.data?.profile)
    return (
      <button className="p-6" onClick={() => me.refetch()}>
        Não foi possível carregar o perfil. Tentar novamente
      </button>
    );
  return <ProfileForm key={me.data.profile.id} profile={me.data.profile} />;
}
function ProfileForm({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ["me"] });
    await cache.invalidateQueries({ queryKey: ["comments"] });
    await cache.invalidateQueries({ queryKey: ["public-profile"] });
  }
  async function saveAvatar(blob: Blob | null) {
    setBusy(true);
    const path = blob ? `${user!.id}/${crypto.randomUUID()}.webp` : null;
    try {
      if (blob && path) {
        const result = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: "image/webp" });
        if (result.error) throw result.error;
      }
      try {
        await community("giro_avatar", { p_path: path });
      } catch (error) {
        if (path) await supabase.storage.from("avatars").remove([path]);
        throw error;
      }
      await refresh();
      if (profile.avatar_url?.startsWith(`${user!.id}/`))
        await supabase.storage.from("avatars").remove([profile.avatar_url]);
      toast.success(blob ? "Foto atualizada." : "Foto removida.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6 p-5">
      <div className="flex items-center gap-3">
        <UserAvatar url={profile.avatar_url} name={profile.display_name} />
        <span>{profile.display_name ?? "Leitor"}</span>
      </div>
      <AvatarEditor onSave={saveAvatar} busy={busy} />
      {profile.avatar_url && (
        <Button
          disabled={busy}
          variant="outline"
          onClick={() =>
            saveAvatar(null).catch(() => toast.error("Não foi possível remover a foto."))
          }
        >
          Remover foto
        </Button>
      )}
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          setBusy(true);
          try {
            await community("giro_save_profile", {
              p_data: {
                display_name: String(fields.get("display_name")),
                username: String(fields.get("username")),
                bio: String(fields.get("bio")),
                city: String(fields.get("city")),
                state: String(fields.get("state")).toUpperCase(),
                interests: String(fields.get("interests"))
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                show_location: fields.get("show_location") === "on",
              },
            });
            await refresh();
            toast.success("Perfil salvo.");
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {(
          [
            { name: "display_name", label: "Nome de exibição", max: 80 },
            { name: "username", label: "Nome de usuário", max: 30 },
            { name: "bio", label: "Bio (opcional)", max: 500 },
            { name: "city", label: "Cidade (privada por padrão)", max: 100 },
            { name: "state", label: "Estado (UF)", max: 2 },
          ] as const
        ).map((field) => (
          <label key={field.name} className="block">
            {field.label}
            <input
              name={field.name}
              defaultValue={profile[field.name] ?? ""}
              required={field.name === "username"}
              maxLength={field.max}
              pattern={field.name === "username" ? "[a-zA-Z0-9_]{3,30}" : undefined}
              className="mt-1 w-full rounded-xl border bg-card p-3"
            />
          </label>
        ))}
        <label className="block">
          Interesses (privados, separados por vírgula)
          <input
            name="interests"
            defaultValue={profile.interests.join(", ")}
            maxLength={1000}
            className="mt-1 w-full rounded-xl border bg-card p-3"
          />
        </label>
        <label className="flex gap-2">
          <input type="checkbox" name="show_location" defaultChecked={profile.show_location} />
          Permitir exibição pública de cidade e estado
        </label>
        <p className="text-xs text-muted-foreground">
          Seu e-mail e interesses ficam privados. A foto e o nome de exibição aparecem nos
          comentários.
        </p>
        <Button disabled={busy}>{busy ? "Salvando…" : "Salvar perfil"}</Button>
      </form>
    </div>
  );
}
