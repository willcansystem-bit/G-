import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { community } from "@/lib/community";
import { PageHeader } from "@/components/giro/AppShell";
import { Access } from "@/components/giro/Access";
import { TeamInbox } from "@/components/giro/TeamInbox";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/administracao")({
  component: () => (
    <>
      <PageHeader title="Administração" />
      <Access role="staff">
        <Administration />
      </Access>
    </>
  ),
});
function Administration() {
  const [tab, setTab] = useState("inbox");
  return (
    <>
      <div className="flex gap-4 p-4">
        <button aria-pressed={tab === "inbox"} onClick={() => setTab("inbox")}>
          Caixa de atendimento
        </button>
        <button aria-pressed={tab === "reports"} onClick={() => setTab("reports")}>
          Moderação
        </button>
      </div>
      {tab === "inbox" ? <TeamInbox staff /> : <Reports />}
    </>
  );
}
function Reports() {
  const [offset, setOffset] = useState(0);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["reports", offset],
    queryFn: () =>
      community<{ id: string; body: string; reason: string }[]>("giro_reports", {
        p_offset: offset,
      }),
  });
  const moderate = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove: boolean }) =>
      community("giro_moderate", { p_report: id, p_remove: remove }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["reports"] });
      cache.invalidateQueries({ queryKey: ["comments"] });
      toast.success("Denúncia revisada.");
    },
    onError: () => toast.error("Não foi possível moderar."),
  });
  return (
    <div className="space-y-4 p-4">
      {query.isPending && <p>Carregando denúncias…</p>}
      {query.isError && <Button onClick={() => query.refetch()}>Tentar novamente</Button>}
      {query.data?.length === 0 && <p>Nenhuma denúncia pendente.</p>}
      {query.data?.map((report) => (
        <section key={report.id} className="space-y-3 rounded-xl border p-4">
          <p className="whitespace-pre-wrap break-words">{report.body}</p>
          <p className="text-sm text-muted-foreground">{report.reason}</p>
          <div className="flex gap-2">
            <Button
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: report.id, remove: true })}
            >
              Remover comentário
            </Button>
            <Button
              variant="outline"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ id: report.id, remove: false })}
            >
              Manter e resolver
            </Button>
          </div>
        </section>
      ))}
      <div className="flex gap-3">
        <Button disabled={!offset} onClick={() => setOffset(offset - 30)}>
          Anterior
        </Button>
        <Button disabled={query.data?.length !== 30} onClick={() => setOffset(offset + 30)}>
          Próximas
        </Button>
      </div>
    </div>
  );
}
