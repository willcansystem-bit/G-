import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  Home,
  LayoutGrid,
  User,
  Menu,
  Mail,
  Settings,
  LogIn,
  Shield,
  ChartNoAxesCombined,
} from "lucide-react";
import { fetchChannels } from "@/lib/api";
import { community } from "@/lib/community";
import { rememberIntent, useAuth, useMyState } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Logo } from "./Brand";
import { UserAvatar } from "./UserAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/canais", label: "Canais", icon: LayoutGrid },
  { to: "/salvos", label: "Salvos", icon: Bookmark },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function channelsQuery() {
  return { queryKey: ["channels"], queryFn: fetchChannels, staleTime: 60_000 };
}

function MoreLinks() {
  const { user } = useAuth();
  const { data: roles } = useRoles();
  const me = useMyState();
  const unread = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: () => community<number>("giro_unread"),
  });
  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {user && (
        <Link to="/perfil" className="flex items-center gap-2">
          <UserAvatar url={me.data?.profile?.avatar_url} name={me.data?.profile?.display_name} />
          <span>{me.data?.profile?.display_name ?? "Meu perfil"}</span>
        </Link>
      )}
      <Link to="/contato" className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
        <Mail className="h-5 w-5 shrink-0" />
        Fale com o Giro+ {unread.data ? `(${unread.data})` : ""}
      </Link>
      <Link
        to="/configuracoes"
        className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary"
      >
        <Settings className="h-5 w-5 shrink-0" />
        Configurações
      </Link>
      {roles?.staff && (
        <Link
          to="/administracao"
          className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary"
        >
          <Shield className="h-5 w-5 shrink-0" />
          Administração
        </Link>
      )}
      {roles?.admin && (
        <Link to="/metricas" className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary">
          <ChartNoAxesCombined className="h-5 w-5 shrink-0" />
          Métricas
        </Link>
      )}
      {!user && (
        <Link
          to="/entrar"
          className="flex items-center gap-3 rounded-xl p-2 font-semibold text-primary hover:bg-secondary"
        >
          <LogIn className="h-5 w-5 shrink-0" />
          Entrar com Google
        </Link>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const publicPage = location.pathname === "/" || location.pathname === "/entrar";
  useEffect(() => {
    if (!loading && !user && !publicPage) {
      rememberIntent(location.href);
      navigate({ to: "/entrar" });
    }
  }, [loading, user, publicPage, location.href, navigate]);
  return (
    <div className="mx-auto flex min-h-screen justify-center bg-app-surround">
      <main className="min-h-screen w-full max-w-[640px] border-x border-border bg-background pb-24 shadow-xl">
        {publicPage || (!loading && user) ? (
          children
        ) : (
          <p className="p-6 text-muted-foreground">
            {loading ? "Verificando sua sessão…" : "Entre com Google para continuar…"}
          </p>
        )}
      </main>
      <nav
        aria-label="Navegação inferior"
        className="glass fixed bottom-2 left-1/2 z-40 flex w-[calc(100%_-_1rem)] max-w-[624px] -translate-x-1/2 justify-around rounded-3xl border py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/", includeSearch: false }}
            className="flex flex-col items-center gap-1 px-3 text-xs text-muted-foreground data-[status=active]:text-primary"
          >
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const unread = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: () => community<number>("giro_unread"),
  });
  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-xl font-bold">{title ?? <Logo />}</h1>
        <div className="flex items-center gap-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Menu"
                className="rounded-full p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Menu className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="glass w-72 max-w-[calc(100vw_-_2rem)] rounded-2xl border p-1"
              onClick={() => setOpen(false)}
            >
              <nav aria-label="Mais opções">
                <MoreLinks />
              </nav>
            </PopoverContent>
          </Popover>
          <Link
            to="/notificacoes"
            aria-label={unread.data ? `Notificações: ${unread.data} não lidas` : "Notificações"}
            className="relative rounded-full p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {!!unread.data && (
              <span className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold text-primary-foreground">
                {unread.data > 99 ? "99+" : unread.data}
              </span>
            )}
          </Link>
        </div>
      </div>
      {children}
    </header>
  );
}
