import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { compact } from "@/lib/api";
import { ChannelAvatar, Verified } from "@/components/giro/Brand";
import { FollowButton } from "@/components/giro/FollowButton";
import { PageHeader, channelsQuery } from "@/components/giro/AppShell";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais — Giro+" },
      { name: "description", content: "Todos os subcanais editoriais do Giro+: Saúde, Cidades, Política, Receitas e mais." },
      { property: "og:title", content: "Canais — Giro+" },
      { property: "og:description", content: "Siga os subcanais que importam para você." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Channels,
});

function Channels() {
  const { data, isPending } = useQuery(channelsQuery());
  return (
    <>
      <PageHeader title="Canais" />
      <h1 className="px-4 pt-4 text-xl font-bold md:hidden">Canais</h1>
      <ul>
        {isPending && <li className="p-6 text-muted-foreground">Carregando…</li>}
        {data?.map((c) => (
          <li key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <ChannelAvatar channel={c} size={48} />
            <Link to="/canal/$slug" params={{ slug: c.slug }} className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold hover:underline">{c.name} <Verified /></p>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <p className="text-xs text-muted-foreground">{compact(c.followers_count)} seguidores</p>
            </Link>
            <FollowButton channelId={c.id} />
          </li>
        ))}
      </ul>
    </>
  );
}
