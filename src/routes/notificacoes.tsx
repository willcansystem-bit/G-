import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { community } from "@/lib/community";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/giro/AppShell";
import { Access } from "@/components/giro/Access";
export const Route = createFileRoute("/notificacoes")({
  component: () => (
    <>
      <PageHeader title="Notificações" />
      <Access>
        <Notifications />
      </Access>
    </>
  ),
});
function Notifications() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: () => community<number>("giro_unread"),
    refetchInterval: 15000,
  });
  return (
    <div className="space-y-4 p-6">
      {query.isPending ? (
        "Carregando…"
      ) : query.isError ? (
        <button onClick={() => query.refetch()}>Tentar novamente</button>
      ) : (
        <p>
          {query.data
            ? `${query.data} mensagem(ns) não lida(s) no atendimento.`
            : "Nenhuma mensagem não lida."}
        </p>
      )}
      <Link to="/contato" className="text-primary">
        Abrir conversa com o Giro+
      </Link>
    </div>
  );
}
