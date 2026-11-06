import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useMyState } from "@/hooks/useAuth";
import { Feed } from "@/components/giro/Feed";
import { PageHeader } from "@/components/giro/AppShell";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { tab?: "para-voce" | "ultimas" } => ({
    tab: search["tab"] === "para-voce" ? "para-voce" : "ultimas",
  }),
  head: () => ({ meta: [{ title: "Giro+ — notícias com conversa" }] }),
  component: Home,
});

function Home() {
  const { tab = "ultimas" } = Route.useSearch();
  const { user, loading } = useAuth();
  const me = useMyState();
  const follows = [...(me.data?.follows ?? [])].sort();
  return (
    <>
      <PageHeader>
        <div role="tablist" aria-label="Feed" className="flex">
          {(
            [
              ["para-voce", "Para você"],
              ["ultimas", "Últimas"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              to="/"
              search={{ tab: value }}
              role="tab"
              aria-selected={tab === value}
              className="flex-1 border-b-2 border-transparent py-4 text-center font-semibold text-muted-foreground aria-selected:border-primary aria-selected:text-foreground"
            >
              {label}
            </Link>
          ))}
        </div>
      </PageHeader>
      {tab === "ultimas" ? (
        <Feed queryKey={["ultimas"]} showFollow />
      ) : loading || (user && me.isPending) ? (
        <p className="p-6">Carregando seu giro…</p>
      ) : !user ? (
        <EmptyCta
          text="Entre com Google para acompanhar os canais que você segue."
          to="/entrar"
          cta="Entrar com Google"
        />
      ) : me.isError ? (
        <button className="p-6" onClick={() => me.refetch()}>
          Não foi possível carregar seus canais. Tentar novamente
        </button>
      ) : follows.length === 0 ? (
        <EmptyCta
          text="Seu giro começa aqui. Siga os canais que você gosta para acompanhar as notícias."
          to="/canais"
          cta="Escolher canais"
        />
      ) : (
        <Feed queryKey={["para-voce", user.id, follows.join(",")]} channelIds={follows} />
      )}
    </>
  );
}

function EmptyCta({ text, to, cta }: { text: string; to: "/entrar" | "/canais"; cta: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-muted-foreground">{text}</p>
      <Link
        to={to}
        className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
      >
        {cta}
      </Link>
    </div>
  );
}
