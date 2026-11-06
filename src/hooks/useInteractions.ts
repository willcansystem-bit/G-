import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rememberIntent, useAuth, useMyState } from "./useAuth";

type MyState = NonNullable<ReturnType<typeof useMyState>["data"]>;

export function useRequireAuth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.href });
  return (): boolean => {
    if (user) return true;
    rememberIntent(path);
    toast("Entre para interagir", { description: "Continue com sua conta Google." });
    navigate({ to: "/entrar" });
    return false;
  };
}

function useToggle(kind: "likes" | "saves" | "follows") {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["me", user?.id];
  return useMutation({
    mutationKey: ["toggle", kind],
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const uid = user!.id;
      if (kind === "likes") {
        const t = supabase.from("post_likes");
        const r = on
          ? await t.insert({ user_id: uid, post_id: id })
          : await t.delete().eq("user_id", uid).eq("post_id", id);
        if (r.error) throw r.error;
      } else if (kind === "saves") {
        const t = supabase.from("saved_posts");
        const r = on
          ? await t.insert({ user_id: uid, post_id: id })
          : await t.delete().eq("user_id", uid).eq("post_id", id);
        if (r.error) throw r.error;
      } else {
        const t = supabase.from("channel_follows");
        const r = on
          ? await t.insert({ user_id: uid, channel_id: id })
          : await t.delete().eq("user_id", uid).eq("channel_id", id);
        if (r.error) throw r.error;
      }
    },
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MyState>(key);
      if (prev) {
        const next = new Set(prev[kind]);
        if (on) next.add(id);
        else next.delete(id);
        qc.setQueryData<MyState>(key, { ...prev, [kind]: next });
      }
      return { wasOn: prev?.[kind].has(id) ?? false };
    },
    onError: (_error, variables, context) => {
      qc.setQueryData<MyState>(key, (current) => {
        if (!current) return current;
        const restored = new Set(current[kind]);
        if (context?.wasOn) restored.add(variables.id);
        else restored.delete(variables.id);
        return { ...current, [kind]: restored };
      });
      toast.error("Não foi possível concluir. Tente novamente.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["toggle"] }) === 1) qc.invalidateQueries({ queryKey: key });
      if (kind === "saves") qc.invalidateQueries({ queryKey: ["saved"] });
      if (kind === "follows") qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

export const useToggleLike = () => useToggle("likes");
export const useToggleSave = () => useToggle("saves");
export const useToggleFollow = () => useToggle("follows");
