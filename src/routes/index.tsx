import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { type FeedTab } from "@/lib/api";
import { useAuth, useMyState } from "@/hooks/useAuth";
import { Feed } from "@/components/giro/Feed";
import { PageHeader, channelsQuery } from "@/components/giro/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Giro+ — notícias com conversa" },
      { name: "description", content: "Timeline de notícias do Giro+ por subcanais: saúde, cidades, política, tecnologia e muito mais." },
      { property: "og:title", content: "Giro+ — notícias com conversa" },
      { property: "og:description", content: "Timeline de notícias por subcanais editoriais, com comentários e comunidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TABS: { id: FeedTab; label: string }[] = [
  { id: "para-voce", label: "Para você" },
  { id: "seguindo", label: "Seguindo" },
  { id: "ultimas", label: "Últimas" },
];

function Home() {
  const [tab, setTab] = useState<FeedTab>("para-voce");
  const { user } = useAuth();
  const { data: me } = useMyState();
  const { data: channels } = useQuery(channelsQuery());

  const interestIds = new Set<string>([
    ...(me?.follows ?? []),
    ...((channels ?? []).filter((c) => me?.profile?.interests.includes(c.slug)).map((c) => c.id)),
  ]);
  const follows = [...(me?.follows ?? [])].sort();

  return (
    <>
      <PageHeader title="Início">
        <div role="tablist" className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 aria-selected:font-bold aria-selected:text-foreground"
            >
              {t.label}
              <span
                className={cn(
                  "absolute bottom-0 left-1/2 h-1 -translate-x-1/2 rounded-full bg-primary transition-all duration-200",
                  tab === t.id ? "w-14" : "w-0",
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden [scrollbar-width:none]">
          {(channels ?? []).map((c) => (
            <Link
              key={c.id}
              to="/canal/$slug"
              params={{ slug: c.slug }}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </PageHeader>

      {tab === "para-voce" && (
        <>
          <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            Ordenado por canais que você segue e interesses, destaque editorial e recência.
          </p>
          <Feed queryKey={["para-voce"]} preferred={interestIds} />
        </>
      )}
      {tab === "seguindo" &&
        (!user ? (
          <EmptyCta text="Entre para montar seu feed com os canais que você segue." to="/entrar" cta="Entrar" />
        ) : follows.length === 0 ? (
          <EmptyCta text="Você ainda não segue nenhum canal." to="/canais" cta="Descobrir canais" />
        ) : (
          <Feed queryKey={["seguindo", follows.join(",")]} channelIds={follows} />
        ))}
      {tab === "ultimas" && <Feed queryKey={["ultimas"]} />}
    </>
  );
}

function EmptyCta({ text, to, cta }: { text: string; to: "/entrar" | "/canais"; cta: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-muted-foreground">{text}</p>
      <Link to={to} className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
        {cta}
      </Link>
    </div>
  );
}
