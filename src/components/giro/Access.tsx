import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";

export function Access({ children, role }: { children: ReactNode; role?: "admin" | "staff" }) {
  const { user, loading } = useAuth();
  const roles = useRoles();
  if (loading || (user && role && roles.isPending)) return <p className="p-6">Carregando…</p>;
  if (!user)
    return (
      <p className="p-6">
        <Link to="/entrar" className="text-primary">
          Entre com Google para continuar.
        </Link>
      </p>
    );
  if (role && !roles.data?.[role])
    return (
      <p role="alert" className="p-6">
        Acesso restrito à equipe autorizada.
        {roles.isError && <button onClick={() => roles.refetch()}>Tentar novamente</button>}
      </p>
    );
  return children;
}
