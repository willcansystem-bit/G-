import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { community, type Profile } from "@/lib/community";

type Ctx = { user: User | null; loading: boolean };
const AuthContext = createContext<Ctx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const sessionUser = useRef<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let recordedDay = "";
    const record = () => {
      const day = new Date().toISOString().slice(0, 10);
      if (document.visibilityState !== "hidden" && day !== recordedDay) {
        community("giro_activity")
          .then(() => {
            recordedDay = day;
          })
          .catch(() => {});
      }
    };
    record();
    const timer = window.setInterval(record, 60000);
    document.addEventListener("visibilitychange", record);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", record);
    };
  }, [userId]);

  useEffect(() => {
    let authEventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      authEventReceived = true;
      const nextUser = session?.user.id ?? null;
      if (sessionUser.current !== nextUser) qc.clear();
      sessionUser.current = nextUser;
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        qc.invalidateQueries({ queryKey: ["me"] });
      }
    });
    supabase.auth
      .getSession()
      .then(({ data: s }) => {
        if (!authEventReceived) {
          sessionUser.current = s.session?.user.id ?? null;
          setUser(s.session?.user ?? null);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        supabase.from("post_likes").select("post_id").eq("user_id", user!.id),
        supabase.from("saved_posts").select("post_id").eq("user_id", user!.id),
        supabase.from("channel_follows").select("channel_id").eq("user_id", user!.id),
        community<Profile>("giro_profile"),
      ]);
      for (const result of [likes, saves, follows]) if (result.error) throw result.error;
      return {
        likes: new Set((likes.data ?? []).map((r) => r.post_id)),
        saves: new Set((saves.data ?? []).map((r) => r.post_id)),
        follows: new Set((follows.data ?? []).map((r) => r.channel_id)),
        profile,
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
