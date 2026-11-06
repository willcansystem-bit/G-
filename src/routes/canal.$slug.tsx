import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { compact, fetchChannel, type Channel } from "@/lib/api";
import { ChannelAvatar, Verified } from "@/components/giro/Brand";
import { FollowButton } from "@/components/giro/FollowButton";
import { Feed } from "@/components/giro/Feed";
import { PageHeader } from "@/components/giro/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/canal/$slug")({
  head: () => ({ meta: [{ title: "Canal — Giro+" }, { name: "robots", content: "noindex" }] }),
  component: ChannelRoute,
});

function ChannelRoute() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["channel-page", user?.id, slug],
    enabled: !!user,
    queryFn: () => fetchChannel(slug),
  });
  if (query.isPending) return <p className="p-6">Carregando canal…</p>;
  if (query.isError)
    return (
      <button className="p-6" onClick={() => query.refetch()}>
        Não foi possível carregar. Tentar novamente
      </button>
    );
  if (!query.data) return <p className="p-6">Canal indisponível.</p>;
  return <ChannelPage initial={query.data} />;
}

function ChannelPage({ initial }: { initial: Channel }) {
  // live follower count after follow/unfollow
  const { data: channel = initial } = useQuery({
    queryKey: ["channels", initial.slug],
    queryFn: () => fetchChannel(initial.slug).then((c) => c ?? initial),
    initialData: initial,
  });
  return (
    <>
      <PageHeader title={channel.name} />
      <div
        className="h-32 md:h-44"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, ${channel.color}, color-mix(in oklab, ${channel.color} 30%, #101113) 70%)`,
        }}
      />
      <div className="border-b border-border px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between">
          <ChannelAvatar channel={channel} size={84} />
          <FollowButton channelId={channel.id} />
        </div>
        <h1 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold">
          {channel.name} <Verified />
        </h1>
        <p className="mt-1 text-muted-foreground">{channel.description}</p>
        <p className="mt-2 text-sm">
          <b>{compact(channel.followers_count)}</b>{" "}
          <span className="text-muted-foreground">seguidores</span>
        </p>
      </div>
      <Feed
        queryKey={["canal", channel.id]}
        channelIds={[channel.id]}
        empty="Este canal ainda não publicou."
      />
    </>
  );
}
