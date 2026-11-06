import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChannelAvatar, Verified } from "@/components/giro/Brand";
import { FollowButton } from "@/components/giro/FollowButton";
import { PageHeader, channelsQuery } from "@/components/giro/AppShell";
import { useAuth, useMyState } from "@/hooks/useAuth";

export const Route = createFileRoute("/canais")({ component: Channels });
function Channels() {
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const { user } = useAuth();
  const me = useMyState();
  const query = useQuery(channelsQuery());
  const channels = query.data?.filter(
    (channel) =>
      (!mine || me.data?.follows.has(channel.id)) &&
      `${channel.name} ${channel.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <PageHeader title="Canais" />
      <div className="space-y-3 p-4">
        <input
          aria-label="Buscar canais por nome ou assunto"
          placeholder="Buscar por nome ou assunto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-full border bg-card px-4 py-2"
        />
        <div className="flex gap-4">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              aria-pressed={mine === value}
              onClick={() => setMine(value)}
              className="rounded-full px-4 py-2 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {value ? "Meus canais" : "Todos"}
            </button>
          ))}
        </div>
      </div>
      {(query.isPending || (mine && user && me.isPending)) && (
        <p className="p-6">Carregando canais…</p>
      )}
      {(query.isError || (mine && me.isError)) && (
        <button
          className="p-6"
          onClick={() => {
            query.refetch();
            me.refetch();
          }}
        >
          Não foi possível carregar. Tentar novamente
        </button>
      )}
      {mine && !user ? (
        <p className="p-6">
          <Link to="/entrar" className="text-primary">
            Entre para gerenciar seus canais.
          </Link>
        </p>
      ) : (
        <ul>
          {channels?.map((channel) => (
            <li key={channel.id} className="flex items-center gap-3 border-b px-4 py-4">
              <ChannelAvatar channel={channel} size={48} />
              <Link to="/canal/$slug" params={{ slug: channel.slug }} className="min-w-0 flex-1">
                <p className="flex gap-1 font-semibold">
                  {channel.name}
                  <Verified />
                </p>
                <p className="text-sm text-muted-foreground">{channel.description}</p>
              </Link>
              <FollowButton channelId={channel.id} />
            </li>
          ))}
        </ul>
      )}
      {channels?.length === 0 && (!mine || user) && (
        <p className="p-6 text-muted-foreground">Nenhum canal encontrado.</p>
      )}
    </>
  );
}
