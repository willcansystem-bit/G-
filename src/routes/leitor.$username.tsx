import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { community } from "@/lib/community";
import { PageHeader } from "@/components/giro/AppShell";
import { UserAvatar } from "@/components/giro/UserAvatar";
type PublicProfile = {
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
};
export const Route = createFileRoute("/leitor/$username")({ component: ReaderProfile });
function ReaderProfile() {
  const { username } = Route.useParams();
  const query = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => community<PublicProfile | null>("giro_public_profile", { p_username: username }),
  });
  return (
    <>
      <PageHeader title="Perfil do leitor" />
      <div className="space-y-3 p-5">
        {query.isPending && <p>Carregando perfil…</p>}
        {query.isError && (
          <button onClick={() => query.refetch()}>
            Não foi possível carregar. Tentar novamente
          </button>
        )}
        {query.isSuccess && !query.data && <p>Perfil não encontrado.</p>}
        {query.data && (
          <>
            <UserAvatar url={query.data.avatar_url} name={query.data.display_name} />
            <h2 className="text-xl font-bold">{query.data.display_name ?? "Leitor"}</h2>
            <p className="text-muted-foreground">@{query.data.username}</p>
            {query.data.bio && <p className="whitespace-pre-wrap break-words">{query.data.bio}</p>}
            {query.data.city && (
              <p>
                {query.data.city}
                {query.data.state && ` · ${query.data.state}`}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
