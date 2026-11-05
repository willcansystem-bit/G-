import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = { user: User | null; loading: boolean };
const AuthContext = createContext<Ctx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        qc.invalidateQueries({ queryKey: ["me"] });
      }
    });
    supabase.auth.getSession().then(({ data: s }) => {
      setUser(s.session?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** The signed-in user's private interaction state (likes, saves, follows). */
export function useMyState() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [likes, saves, follows, profile] = await Promise.all([
        supabase.from("post_likes").select("post_id"),
        supabase.from("saved_posts").select("post_id"),
        supabase.from("channel_follows").select("channel_id"),
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
      ]);
      return {
        likes: new Set((likes.data ?? []).map((r) => r.post_id)),
        saves: new Set((saves.data ?? []).map((r) => r.post_id)),
        follows: new Set((follows.data ?? []).map((r) => r.channel_id)),
        profile: profile.data,
      };
    },
  });
}

/** Store an intended action so it can resume after sign-in. */
export function rememberIntent(path: string) {
  try {
    sessionStorage.setItem("giro:next", path);
  } catch {
    /* ignore */
  }
}
export function consumeIntent(): string | null {
  try {
    const v = sessionStorage.getItem("giro:next");
    sessionStorage.removeItem("giro:next");
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}
