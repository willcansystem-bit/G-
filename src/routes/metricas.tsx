import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { community } from "@/lib/community";
import { PageHeader, channelsQuery } from "@/components/giro/AppShell";
import { Access } from "@/components/giro/Access";
import { Button } from "@/components/ui/button";

type Distribution = { label: string; total: number }[];
type Metrics = {
  total: number;
  new_users: number;
  active: number;
  history_since: string | null;
  followers: { id: string; name: string; followers: number; growth: number }[];
  evolution: { day: string; channel_id: string; net_change: number }[];
  posts: { id: string; title: string; likes: number; comments: number; saves: number }[];
  cities: Distribution;
  states: Distribution;
  interests: Distribution;
};
type Reader = {
  id: string;
  display_name: string | null;
  email: string;
  city: string | null;
  state: string | null;
  interests: string[];
  created_at: string;
  channels: string[];
  status: string;
};
export const Route = createFileRoute("/metricas")({
  component: () => (
    <>
      <PageHeader title="Métricas" />
      <Access role="admin">
        <MetricsPage />
      </Access>
    </>
  ),
});
function MetricsPage() {
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState("");
  const [rank, setRank] = useState<"likes" | "comments" | "saves">("likes");
  const channels = useQuery(channelsQuery());
  const query = useQuery({
    queryKey: ["metrics", from, to, channel],
    enabled: !!from && !!to && from <= to,
    queryFn: () =>
      community<Metrics>("giro_metrics", { p_from: from, p_to: to, p_channel: channel || null }),
  });
  const data = query.data;
  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap gap-3">
        <label>
          De
          <input
            type="date"
            aria-label="Início do período"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="block rounded-xl border bg-card p-2"
          />
        </label>
        <label>
          Até
          <input
            type="date"
            aria-label="Fim do período"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="block rounded-xl border bg-card p-2"
          />
        </label>
        <label>
          Canal
          <select
            className="block max-w-48 rounded-xl border bg-card p-2"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          >
            <option value="">Todos</option>
            {channels.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {from > to && <p role="alert">Escolha um período válido.</p>}
      {query.isFetching && <p>Carregando métricas…</p>}
      {query.isError && (
        <Button onClick={() => query.refetch()}>Não foi possível carregar. Tentar novamente</Button>
      )}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Usuários cadastrados (total geral)" value={data.total} />
            <Stat label="Novos cadastros no período (geral)" value={data.new_users} />
            <Stat label="Usuários ativos no período" value={data.active} />
          </div>
          <p className="text-xs text-muted-foreground">
            Ativo: usuário autenticado que abriu o app em um dia do período (UTC), contado uma vez.
            O filtro de canal considera os seguidores atuais. Cadastros são globais. Interações são
            relações ainda existentes criadas no período. Sem coleta de visualizações ou
            compartilhamentos.
          </p>
          <h2 className="text-lg font-bold">Seguidores e crescimento</h2>
          <p className="text-xs text-muted-foreground">
            Relações ativas e únicas por canal. A mesma pessoa pode seguir vários canais. Histórico
            coletado desde{" "}
            {data.history_since
              ? new Date(data.history_since).toLocaleDateString("pt-BR")
              : "a ativação da coleta"}
            ; o primeiro dia inclui a base existente, sem reconstruir o passado.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Seguidores atuais</th>
                  <th>Variação no período</th>
                </tr>
              </thead>
              <tbody>
                {data.followers.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3">{item.name}</td>
                    <td>{item.followers}</td>
                    <td>
                      {item.growth > 0 ? "+" : ""}
                      {item.growth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary className="cursor-pointer font-semibold">
              Evolução diária dos seguidores
            </summary>
            {data.evolution.length ? (
              <ul className="space-y-2 py-3 text-sm">
                {data.evolution.map((item) => (
                  <li key={`${item.day}-${item.channel_id}`}>
                    {item.day} ·{" "}
                    {data.followers.find((row) => row.id === item.channel_id)?.name ?? "Canal"}:{" "}
                    {item.net_change > 0 ? "+" : ""}
                    {item.net_change}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sem eventos no período.</p>
            )}
          </details>
          <h2 className="font-bold">Publicações com mais interações</h2>
          <select
            aria-label="Ordenar publicações"
            value={rank}
            onChange={(event) => setRank(event.target.value as typeof rank)}
            className="rounded-xl border bg-card p-2"
          >
            <option value="likes">Curtidas</option>
            <option value="comments">Comentários</option>
            <option value="saves">Salvamentos</option>
          </select>
          <ul>
            {[...data.posts]
              .sort((left, right) => right[rank] - left[rank])
              .map((post) => (
                <li className="border-b py-3 text-sm" key={post.id}>
                  <b>{post.title}</b>
                  <p>
                    {post.likes} curtidas · {post.comments} comentários · {post.saves} salvamentos
                  </p>
                </li>
              ))}
          </ul>
          <h2 className="font-bold">Distribuição atual dos usuários</h2>
          {(
            [
              ["Cidades", data.cities],
              ["Estados", data.states],
              ["Interesses informados", data.interests],
            ] as const
          ).map(([label, rows]) => (
            <details key={label}>
              <summary>{label}</summary>
              <ul className="space-y-1 py-2 text-sm">
                {rows.map((row) => (
                  <li key={row.label}>
                    {row.label}: {row.total}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </>
      )}
      <ReaderTable />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <b className="text-2xl">{value}</b>
    </div>
  );
}
function ReaderTable() {
  const [filters, setFilters] = useState({ q: "", city: "", state: "", interest: "", channel: "" });
  const [offset, setOffset] = useState(0);
  const channels = useQuery(channelsQuery());
  const query = useQuery({
    queryKey: ["admin-users", filters, offset],
    queryFn: () => community<Reader[]>("giro_users", { p_filters: filters, p_offset: offset }),
  });
  return (
    <section className="space-y-4 border-t pt-5">
      <h2 className="text-lg font-bold">Usuários cadastrados</h2>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["q", "Nome ou e-mail"],
            ["city", "Cidade"],
            ["state", "Estado (UF)"],
            ["interest", "Interesse informado"],
          ] as const
        ).map(([key, label]) => (
          <input
            key={key}
            aria-label={label}
            placeholder={label}
            value={filters[key]}
            onChange={(event) => {
              setFilters({
                ...filters,
                [key]: key === "state" ? event.target.value.toUpperCase() : event.target.value,
              });
              setOffset(0);
            }}
            className="min-w-0 rounded-xl border bg-card p-2"
          />
        ))}
        <select
          aria-label="Filtrar por canal seguido"
          value={filters.channel}
          onChange={(event) => {
            setFilters({ ...filters, channel: event.target.value });
            setOffset(0);
          }}
          className="col-span-2 rounded-xl border bg-card p-2"
        >
          <option value="">Todos os canais</option>
          {channels.data?.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </div>
      {query.isFetching && <p>Carregando usuários…</p>}
      {query.isError && <Button onClick={() => query.refetch()}>Tentar novamente</Button>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {[
                "Nome",
                "E-mail",
                "Cidade",
                "Estado",
                "Interesses",
                "Cadastro",
                "Canais seguidos",
                "Status",
              ].map((label) => (
                <th className="px-2 py-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {query.data?.map((reader) => (
              <tr key={reader.id} className="border-b">
                {[
                  reader.display_name,
                  reader.email,
                  reader.city,
                  reader.state,
                  reader.interests.join(", "),
                  new Date(reader.created_at).toLocaleDateString("pt-BR"),
                  reader.channels.join(", "),
                  reader.status,
                ].map((value, index) => (
                  <td key={index} className="min-w-28 px-2 py-3">
                    {value || "Não informado"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data?.length === 0 && <p>Nenhum usuário encontrado.</p>}
      <div className="flex gap-3">
        <Button variant="outline" disabled={!offset} onClick={() => setOffset(offset - 30)}>
          Anterior
        </Button>
        <span className="self-center text-sm">Página {offset / 30 + 1}</span>
        <Button
          variant="outline"
          disabled={query.data?.length !== 30}
          onClick={() => setOffset(offset + 30)}
        >
          Próximos
        </Button>
      </div>
    </section>
  );
}
