import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type Post } from "@/lib/api";
import { Access } from "@/components/giro/Access";
import { PageHeader } from "@/components/giro/AppShell";
import { PostItem } from "@/components/giro/PostItem";

export const Route = createFileRoute("/salvos")({
  component: () => (
    <>
      <PageHeader title="Salvos" />
      <Access>
        <Saved />
      </Access>
    </>
  ),
});
function Saved() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_posts")
        .select("post:posts(*,channel:channels(id,slug,name,color))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((row) => row.post).filter(Boolean) as unknown as Post[];
    },
  });
  return (
    <>
      {query.isPending && <p className="p-6">Carregando…</p>}
      {query.isError && (
        <button className="p-6" onClick={() => query.refetch()}>
          Tentar novamente
        </button>
      )}
      {query.data?.length === 0 && <p className="p-6">Você ainda não salvou notícias.</p>}
      {query.data?.map((post) => (
        <PostItem key={post.id} post={post} />
      ))}
    </>
  );
}
