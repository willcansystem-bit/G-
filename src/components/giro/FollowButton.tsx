import { cn } from "@/lib/utils";
import { useMyState } from "@/hooks/useAuth";
import { useRequireAuth, useToggleFollow } from "@/hooks/useInteractions";
import { useIsMutating } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export function FollowButton({
  channelId,
  small,
  onlyUnfollowed,
}: {
  channelId: string;
  small?: boolean;
  onlyUnfollowed?: boolean;
}) {
  const { user } = useAuth();
  const { data: me, isPending, isError } = useMyState();
  const requireAuth = useRequireAuth();
  const follow = useToggleFollow();
  const on = me?.follows.has(channelId) ?? false;
  const pending = useIsMutating({
    mutationKey: ["toggle", "follows"],
    predicate: (mutation) =>
      (mutation.state.variables as { id?: string } | undefined)?.id === channelId,
  });
  if (onlyUnfollowed && on) return null;
  if (onlyUnfollowed && user && (isPending || isError)) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={!!pending || (!!user && (isPending || isError))}
      onClick={() => {
        if (!user) sessionStorage.setItem("giro:follow", channelId);
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
      {on ? "Deixar de seguir" : "+ Seguir"}
    </button>
  );
}
