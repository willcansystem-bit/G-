import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { fetchGuestPosts, fetchPosts, GUEST_POST_LIMIT, type PostCard } from "@/lib/api";
import { rememberIntent, useAuth } from "@/hooks/useAuth";
import { PostItem, PostSkeleton } from "./PostItem";

export function Feed({
  queryKey,
  channelIds,
  showFollow,
  empty,
}: {
  queryKey: unknown[];
  channelIds?: string[];
  showFollow?: boolean;
  empty?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const feedKey = ["feed", user?.id ?? "guest", ...queryKey];
  const q = useInfiniteQuery({
    queryKey: feedKey,
    enabled: !loading,
    staleTime: user ? Infinity : 60000,
    refetchInterval: user ? false : 60000,
    refetchOnMount: false,
    refetchOnWindowFocus: !user,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      user ? fetchPosts({ cursor: pageParam, channelIds }) : fetchGuestPosts(),
    getNextPageParam: (last) => {
      const tail = last.at(-1);
      return user && tail ? `${tail.published_at}|${tail.id}` : undefined;
    },
  });

  const allPages: PostCard[] = (q.data?.pages ?? []).flat();
  const pages = user ? allPages : allPages.slice(0, GUEST_POST_LIMIT);
  const newest = q.data?.pages[0]?.reduce<string | null>(
    (m, p) => (!m || p.published_at > m ? p.published_at : m),
    null,
  );

  // Check for newer posts without shifting what the reader is looking at.
  const fresh = useQuery({
    queryKey: ["feed-new", user?.id ?? "guest", ...queryKey, newest],
    enabled: !!user && !!newest,
    refetchInterval: 60_000,
    queryFn: async () => {
      const latest = await fetchPosts({ channelIds, limit: 1 });
      return latest[0] && newest && latest[0].published_at > newest;
    },
  });

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !user) return;
    const io = new IntersectionObserver(
      (e) => {
        if (
          e[0]?.isIntersecting &&
          q.hasNextPage &&
          !q.isFetchingNextPage &&
          !q.isFetchNextPageError
        )
          q.fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [q, user]);

  if (q.isPending)
    return (
      <>
        {Array.from({ length: 4 }, (_, i) => (
          <PostSkeleton key={i} />
        ))}
      </>
    );
  if (q.isError && !q.data)
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Não foi possível carregar as notícias.</p>
        <Button className="mt-4" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (pages.length === 0)
    return (
      <div className="px-4 py-12 text-center text-muted-foreground">
        {empty ?? "Nada por aqui ainda."}
      </div>
    );

  return (
    <div className="relative">
      {fresh.data && (
        <div className="sticky top-28 z-20 flex justify-center md:top-16">
          <Button
            size="sm"
            className="mt-2 rounded-full shadow-lg"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              qc.resetQueries({ queryKey: feedKey });
            }}
          >
            <ArrowUp className="mr-1 h-4 w-4" /> Há novas notícias
          </Button>
        </div>
      )}
      {pages.map((p) => (
        <PostItem key={p.id} post={p} showFollow={showFollow} />
      ))}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {q.isFetchNextPageError && (
        <Button onClick={() => q.fetchNextPage()}>Tentar carregar mais notícias</Button>
      )}
      {!user && (
        <section className="space-y-3 px-6 py-8 text-center">
          <h2 className="text-lg font-bold">Continue seu giro com a gente</h2>
          <p className="text-sm text-muted-foreground">
            Sem entrar, você vê apenas as cinco notícias mais recentes. Entre com Google para ler as
            notícias completas, acessar todo o feed e participar.
          </p>
          <Link
            to="/entrar"
            onClick={() => rememberIntent("/?tab=ultimas")}
            className="inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            Entrar com Google
          </Link>
        </section>
      )}
      {user && !q.hasNextPage && (
        <p className="py-8 text-center text-sm text-muted-foreground">Você chegou ao fim.</p>
      )}
    </div>
  );
}
