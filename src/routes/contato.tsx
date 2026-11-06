import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/giro/AppShell";
import { Access } from "@/components/giro/Access";
import { TeamInbox } from "@/components/giro/TeamInbox";
export const Route = createFileRoute("/contato")({
  component: () => (
    <>
      <PageHeader title="Fale com o Giro+" />
      <Access>
        <TeamInbox />
      </Access>
    </>
  ),
});
