import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { community, SUBJECTS, type Conversation, type Message } from "@/lib/community";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const STATUS: Record<string, string> = {
  pending: "Pendentes",
  in_progress: "Em atendimento",
  resolved: "Resolvidas",
};
export function TeamInbox({ staff = false }: { staff?: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["inbox", user?.id, staff, search, status, offset],
    refetchInterval: 15000,
    queryFn: () =>
      community<Conversation[]>("giro_inbox", {
        p_search: staff ? search : "",
        p_status: staff ? status : "",
        p_offset: staff ? offset : 0,
        p_own: !staff,
      }),
  });
  const conversation =
    query.data?.find((item) => item.id === selected) ?? (!staff ? query.data?.[0] : undefined);
  return (
    <div className="space-y-4 p-4">
      {staff && (
        <>
          <input
            aria-label="Buscar conversas por nome e assunto"
            placeholder="Nome ou assunto"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
              setSelected(null);
            }}
            className="w-full rounded-xl border bg-card p-3"
          />
          <select
            aria-label="Situação das conversas"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setOffset(0);
              setSelected(null);
            }}
            className="rounded-xl border bg-card p-2"
          >
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
      {query.isPending && <p>Carregando conversas…</p>}
      {query.isError && (
        <Button onClick={() => query.refetch()}>Não foi possível carregar. Tentar novamente</Button>
      )}
      {staff && (
        <>
          <ul className="divide-y">
            {query.data?.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setSelected(item.id)}
                  className="w-full rounded-xl p-3 text-left hover:bg-secondary"
                  aria-pressed={selected === item.id}
                >
                  <b>{item.display_name ?? "Leitor"}</b> · {item.subject}
                  <p className="text-xs text-muted-foreground">
                    {STATUS[item.status]} · {new Date(item.updated_at).toLocaleString("pt-BR")}
                    {item.unread > 0 && ` · ${item.unread} não lida(s)`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {query.data?.length === 0 && <p>Nenhuma conversa encontrada.</p>}
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => {
                setOffset(offset - 30);
                setSelected(null);
              }}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={query.data?.length !== 30}
              onClick={() => {
                setOffset(offset + 30);
                setSelected(null);
              }}
            >
              Próximas
            </Button>
          </div>
        </>
      )}
      {(conversation || (!staff && query.isSuccess)) && (
        <Thread
          key={conversation?.id ?? "new"}
          conversation={conversation}
          staff={staff}
          onCreated={(id) => setSelected(id)}
        />
      )}
    </div>
  );
}

function Thread({
  conversation,
  staff,
  onCreated,
}: {
  conversation?: Conversation | undefined;
  staff: boolean;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState(conversation?.subject ?? SUBJECTS[0]!);
  const messages = useInfiniteQuery({
    queryKey: ["thread", user?.id, conversation?.id],
    enabled: !!conversation,
    initialPageParam: 0,
    refetchInterval: 10000,
    queryFn: ({ pageParam }) =>
      community<Message[]>("giro_thread", {
        p_conversation: conversation!.id,
        p_offset: pageParam,
      }),
    getNextPageParam: (last, pages) => (last.length === 30 ? pages.length * 30 : undefined),
  });
  const send = useMutation({
    mutationFn: () =>
      community<string>("giro_send", {
        p_body: body,
        p_subject: subject,
        p_conversation: staff ? conversation!.id : null,
      }),
    onSuccess: (id) => {
      setBody("");
      onCreated(id);
      cache.invalidateQueries({ queryKey: ["thread"] });
      cache.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: () =>
      toast.error("Não foi possível enviar. Sua mensagem foi mantida para tentar novamente."),
  });
  const updateStatus = useMutation({
    mutationFn: (value: string) =>
      community("giro_status", { p_conversation: conversation!.id, p_status: value }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["inbox"] }),
    onError: () => toast.error("Não foi possível alterar a situação."),
  });
  const items = [
    ...new Map(
      (messages.data?.pages.flat() ?? []).map((message) => [message.id, message]),
    ).values(),
  ].sort(
    (left, right) =>
      left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
  );
  return (
    <section className="space-y-4 border-t pt-4">
      <h2 className="font-bold">
        {staff
          ? `Conversa com ${conversation?.display_name ?? "Leitor"}`
          : "Sua conversa com o Giro+"}
      </h2>
      {staff && (
        <select
          aria-label="Alterar situação"
          value={conversation!.status}
          disabled={updateStatus.isPending}
          onChange={(event) => updateStatus.mutate(event.target.value)}
          className="rounded-xl border bg-card p-2"
        >
          {Object.entries(STATUS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      )}
      {messages.isFetching && (
        <p className="text-xs text-muted-foreground">Atualizando mensagens…</p>
      )}
      {messages.isError && (
        <Button onClick={() => messages.refetch()}>Tentar carregar mensagens novamente</Button>
      )}
      {messages.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => messages.fetchNextPage()}
          disabled={messages.isFetchingNextPage}
        >
          Mensagens anteriores
        </Button>
      )}
      <ol className="space-y-3">
        {items.map((message) => (
          <li
            key={message.id}
            className={`rounded-2xl border p-3 ${message.sender_id === user?.id ? "ml-8 bg-secondary" : "mr-8 bg-card"}`}
          >
            <b className="text-xs">
              {message.sender_id === conversation?.user_id ? "Leitor" : "Equipe Giro+"}
            </b>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleString("pt-BR")}
              {message.sender_id === user?.id &&
                (message.read_at
                  ? ` · Lida em ${new Date(message.read_at).toLocaleString("pt-BR")}`
                  : " · Enviada")}
            </p>
          </li>
        ))}
      </ol>
      {items.length === 0 && !messages.isFetching && (
        <p className="text-sm text-muted-foreground">Envie sua primeira mensagem para a equipe.</p>
      )}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        {!staff && (
          <label className="block">
            Assunto
            <select
              aria-label="Assunto da conversa"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-card p-2"
            >
              {SUBJECTS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          Esta conversa é privada e será respondida pela equipe Giro+.
        </p>
        <textarea
          aria-label="Mensagem para a equipe"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={4000}
          required
          className="w-full rounded-xl border bg-card p-3"
        />
        <Button disabled={send.isPending || !body.trim()}>
          {send.isPending ? "Enviando…" : "Enviar mensagem"}
        </Button>
      </form>
    </section>
  );
}
