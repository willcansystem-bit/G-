import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Compass, Home, LayoutGrid, LogIn, Search, User } from "lucide-react";
import { fetchChannels } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ChannelAvatar, Logo } from "./Brand";
import { FollowButton } from "./FollowButton";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/canais", label: "Canais", icon: LayoutGrid },
  { to: "/salvos", label: "Salvos", icon: Bookmark },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function channelsQuery() {
  return { queryKey: ["channels"], queryFn: fetchChannels, staleTime: 60_000 };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-[1280px] justify-center">
      {/* Esquerda */}
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col gap-2 px-3 py-4 md:flex xl:w-64">
        <div className="px-3 pb-4">
          <span className="hidden xl:inline"><Logo /></span>
          <span className="xl:hidden"><Logo compact /></span>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-4 rounded-full px-3 py-3 text-lg text-foreground transition-colors hover:bg-secondary data-[status=active]:font-bold data-[status=active]:text-primary"
            >
              <Icon className="h-6 w-6" />
              <span className="hidden xl:inline">{label}</span>
            </Link>
          ))}
        </nav>
        {!user && (
          <Link
            to="/entrar"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <LogIn className="h-5 w-5" /> <span className="hidden xl:inline">Entrar</span>
          </Link>
        )}
        <p className="mt-auto hidden px-3 text-xs text-muted-foreground xl:block">
          Ambiente de demonstração · conteúdos ilustrativos
        </p>
      </aside>

      {/* Centro */}
      <main className="min-h-screen w-full max-w-[640px] border-x border-border pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* Direita */}
      <RightRail />

      {/* Navegação inferior (mobile) */}
      <nav
        aria-label="Navegação inferior"
        className="glass fixed inset-x-2 bottom-2 z-40 flex justify-around rounded-3xl border py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1 text-[11px] text-muted-foreground data-[status=active]:text-primary"
          >
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function RightRail() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: channels } = useQuery(channelsQuery());
  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto px-5 py-3 lg:flex">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ to: "/explorar", search: { q } });
        }}
        className="glass sticky top-0 z-10 flex items-center gap-2 rounded-full border px-4 py-2.5"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar no Giro+"
          aria-label="Buscar"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </form>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-lg font-bold">Destaques editoriais</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Assuntos em alta aparecerão quando houver atividade real suficiente.
        </p>
        <Link to="/explorar" className="text-sm font-medium text-primary hover:underline">Ver destaques</Link>
      </section>
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-bold">Canais sugeridos</h2>
        <ul className="space-y-3">
          {(channels ?? []).slice(0, 5).map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <ChannelAvatar channel={c} size={36} />
              <Link to="/canal/$slug" params={{ slug: c.slug }} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold hover:underline">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
              </Link>
              <FollowButton channelId={c.id} small />
            </li>
          ))}
        </ul>
        <Link to="/canais" className="mt-3 block text-sm font-medium text-primary hover:underline">Ver todos</Link>
      </section>
      <footer className="flex flex-wrap gap-x-3 gap-y-1 px-2 pb-4 text-xs text-muted-foreground">
        <Link to="/sobre" className="hover:underline">Privacidade, termos e diretrizes</Link>
        <span>© 2026 Giro+</span>
      </footer>
    </aside>
  );
}

export function PageHeader({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  const { user } = useAuth();
  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="md:hidden"><Logo /></div>
        {title && <h1 className="hidden text-xl font-bold md:block">{title}</h1>}
        <Link
          to={user ? "/perfil" : "/entrar"}
          className="rounded-full p-2 text-muted-foreground hover:bg-secondary md:hidden"
          aria-label={user ? "Perfil" : "Entrar"}
        >
          <User className="h-5 w-5" />
        </Link>
      </div>
      {children}
    </header>
  );
}
