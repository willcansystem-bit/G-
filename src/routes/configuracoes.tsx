import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/giro/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/configuracoes")({ component: Settings });
function Settings() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="space-y-5 p-6">
        <label className="block">
          Aparência
          <select
            aria-label="Tema"
            className="ml-3 rounded-xl border bg-card p-2"
            defaultValue=""
            onChange={(event) => {
              const theme = event.target.value;
              localStorage.setItem("giro:theme", theme);
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark" ||
                  (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches),
              );
            }}
          >
            <option value="" disabled>
              Selecionar tema
            </option>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="auto">Sistema</option>
          </select>
        </label>
        <Link to="/perfil" className="block text-primary">
          Editar perfil e foto
        </Link>
        {user && (
          <Button
            variant="outline"
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) toast.error("Não foi possível sair.");
            }}
          >
            Sair da conta
          </Button>
        )}
      </div>
    </>
  );
}
