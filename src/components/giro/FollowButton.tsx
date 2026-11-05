import { cn } from "@/lib/utils";
import { useMyState } from "@/hooks/useAuth";
import { useRequireAuth, useToggleFollow } from "@/hooks/useInteractions";

export function FollowButton({ channelId, small }: { channelId: string; small?: boolean }) {
  const { data: me } = useMyState();
  const requireAuth = useRequireAuth();
  const follow = useToggleFollow();
  const on = me?.follows.has(channelId) ?? false;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        if (!requireAuth()) return;
        follow.mutate({ id: channelId, on: !on });
      }}
      className={cn(
        "shrink-0 rounded-full font-semibold transition-all active:scale-95",
        small ? "px-3 py-1.5 text-xs" : "px-5 py-2 text-sm",
        on
          ? "border border-border bg-transparent text-foreground hover:border-destructive hover:text-destructive"
          : "bg-foreground text-background hover:opacity-90",
      )}
    >
      {on ? "Seguindo" : "Seguir"}
    </button>
  );
}
