import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { compact, fetchChannel } from "@/lib/api";
import { ChannelAvatar, Verified } from "@/components/giro/Brand";
import { FollowButton } from "@/components/giro/FollowButton";
import { Feed } from "@/components/giro/Feed";
import { PageHeader } from "@/components/giro/AppShell";

export const Route = createFileRoute("/canal/$slug")({
  loader: async ({ params }) => {
    const channel = await fetchChannel(params.slug);
    if (!channel) throw notFound();
    return { channel };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.channel.name} — Giro+` : "Canal — Giro+";
    const desc = loaderData?.channel.description ?? "Canal do Giro+";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ChannelPage,
});

function ChannelPage() {
  const { channel: initial } = Route.useLoaderData();
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
        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${channel.color}, color-mix(in oklab, ${channel.color} 30%, #101113) 70%)` }}
      />
      <div className="border-b border-border px-4 pb-4">
        <div className="-mt-10 flex items-end justify-between">
          <ChannelAvatar channel={channel} size={84} />
          <FollowButton channelId={channel.id} />
        </div>
        <h1 className="mt-3 flex items-center gap-1.5 text-2xl font-extrabold">{channel.name} <Verified /></h1>
        <p className="mt-1 text-muted-foreground">{channel.description}</p>
        <p className="mt-2 text-sm"><b>{compact(channel.followers_count)}</b> <span className="text-muted-foreground">seguidores</span></p>
      </div>
      <Feed queryKey={["canal", channel.id]} channelIds={[channel.id]} empty="Este canal ainda não publicou." />
    </>
  );
}
