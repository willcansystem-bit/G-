import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPosts, scoreForYou, type Post } from "@/lib/api";
import { PostItem, PostSkeleton } from "./PostItem";

export function Feed({
  queryKey,
  channelIds,
  preferred,
  empty,
}: {
  queryKey: unknown[];
  channelIds?: string[];
  /** when set, each page is ordered by the explicable "Para você" score */
  preferred?: Set<string>;
  empty?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["feed", ...queryKey],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchPosts({ cursor: pageParam, channelIds }),
    getNextPageParam: (last) => (last.length ? last[last.length - 1].published_at : undefined),
  });

  const pages: Post[] = (q.data?.pages ?? []).flatMap((page) =>
    preferred ? [...page].sort((a, b) => scoreForYou(b, preferred) - scoreForYou(a, preferred)) : page,
  );
  const newest = q.data?.pages[0]?.reduce<string | null>(
    (m, p) => (!m || p.published_at > m ? p.published_at : m),
    null,
  );

  // Check for newer posts without shifting what the reader is looking at.
  const fresh = useQuery({
    queryKey: ["feed-new", ...queryKey, newest],
    enabled: !!newest,
    refetchInterval: 60_000,
    queryFn: async () => {
      const latest = await fetchPosts({ channelIds, limit: 1 });
      return latest[0] && newest && latest[0].published_at > newest;
    },
  });

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  if (q.isPending) return <>{Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />)}</>;
  if (q.isError)
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground">Não foi possível carregar as notícias.</p>
        <Button className="mt-4" onClick={() => q.refetch()}>Tentar novamente</Button>
      </div>
    );
  if (pages.length === 0) return <div className="px-4 py-12 text-center text-muted-foreground">{empty ?? "Nada por aqui ainda."}</div>;

  return (
    <div className="relative">
      {fresh.data && (
        <div className="sticky top-28 z-20 flex justify-center md:top-16">
          <Button
            size="sm"
            className="mt-2 rounded-full shadow-lg"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              qc.resetQueries({ queryKey: ["feed", ...queryKey] });
            }}
          >
            <ArrowUp className="mr-1 h-4 w-4" /> Há novas notícias
          </Button>
        </div>
      )}
      {pages.map((p) => <PostItem key={p.id} post={p} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <PostSkeleton />}
      {!q.hasNextPage && <p className="py-8 text-center text-sm text-muted-foreground">Você chegou ao fim.</p>}
    </div>
  );
}
