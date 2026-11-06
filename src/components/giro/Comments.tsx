import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { community, type PublicComment } from "@/lib/community";
import { timeAgo } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useInteractions";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";

export function Comments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [parent, setParent] = useState<PublicComment | null>(null);
  const [editing, setEditing] = useState<PublicComment | null>(null);
  const [order, setOrder] = useState("asc");
  const query = useInfiniteQuery({
    queryKey: ["comments", postId, order],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      community<PublicComment[]>("giro_comments", {
        p_post: postId,
        p_offset: pageParam,
        p_order: order,
      }),
    getNextPageParam: (last, pages) => (last.length === 30 ? pages.length * 30 : undefined),
    refetchInterval: 15000,
  });
  const write = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para comentar.");
      const result = editing
        ? await supabase
            .from("comments")
            .update({ body: body.trim() })
            .eq("id", editing.id)
            .eq("user_id", user.id)
        : await supabase.from("comments").insert({
            post_id: postId,
            user_id: user.id,
            body: body.trim(),
            parent_id: parent?.id ?? null,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      setBody("");
      setParent(null);
      setEditing(null);
      cache.invalidateQueries({ queryKey: ["comments", postId] });
      toast.success("Comentário publicado.");
    },
    onError: () => toast.error("Não foi possível salvar o comentário."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["comments", postId] }),
    onError: () => toast.error("Não foi possível excluir."),
  });
  const report = useMutation({
    mutationFn: (id: string) =>
      community("giro_report", { p_comment: id, p_reason: "Solicitação de revisão do leitor" }),
    onSuccess: () => toast.success("Denúncia enviada à equipe."),
    onError: () => toast.error("Não foi possível denunciar."),
  });
  return (
    <section id="comentarios" className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Comentários</h2>
        <select
          aria-label="Ordenação dos comentários"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          className="rounded-xl border bg-card p-2"
        >
          <option value="asc">Mais antigos</option>
          <option value="desc">Mais recentes</option>
        </select>
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (requireAuth()) write.mutate();
        }}
      >
        {(parent || editing) && (
          <p className="text-sm">
            {editing ? "Editando comentário" : `Respondendo a ${parent?.display_name ?? "Leitor"}`}{" "}
            <button
              type="button"
              onClick={() => {
                setParent(null);
                setEditing(null);
                setBody("");
              }}
            >
              Cancelar
            </button>
          </p>
        )}
        <textarea
          aria-label="Seu comentário"
          placeholder={user ? "Escreva um comentário respeitoso…" : "Entre para comentar"}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={1000}
          className="w-full rounded-2xl border bg-card p-3"
        />
        <Button disabled={write.isPending || !body.trim()}>
          {editing ? "Salvar" : "Publicar"}
        </Button>
      </form>
      {query.isPending && <p>Carregando comentários…</p>}
      {query.isError && (
        <Button onClick={() => query.refetch()}>Não foi possível carregar. Tentar novamente</Button>
      )}
      {query.data?.pages.flat().length === 0 && (
        <p className="text-muted-foreground">Seja o primeiro a comentar.</p>
      )}
      <ul>
        {query.data?.pages.flat().map((comment) => (
          <li key={comment.id} className="flex gap-3 border-b py-4">
            <UserAvatar url={comment.avatar_url} name={comment.display_name} />
            <div className="min-w-0 flex-1">
              <p>
                {comment.username ? (
                  <Link
                    to="/leitor/$username"
                    params={{ username: comment.username }}
                    className="font-bold hover:underline"
                  >
                    {comment.display_name ?? "Leitor"}
                  </Link>
                ) : (
                  <b>{comment.display_name ?? "Leitor"}</b>
                )}{" "}
                <span className="text-xs text-muted-foreground">
                  {timeAgo(comment.created_at)} {comment.is_edited && "· editado"}
                </span>
              </p>
              {comment.parent_id && (
                <a href={`#comentario-${comment.parent_id}`} className="text-xs text-primary">
                  Resposta a outro comentário
                </a>
              )}
              <p id={`comentario-${comment.id}`} className="whitespace-pre-wrap break-words">
                {comment.body}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-primary">
                <button
                  onClick={() => {
                    if (requireAuth()) {
                      setParent(comment);
                      setEditing(null);
                      setBody("");
                      document.getElementById("comentarios")?.scrollIntoView();
                    }
                  }}
                >
                  Responder
                </button>
                {user?.id === comment.user_id && (
                  <>
                    <button
                      onClick={() => {
                        setEditing(comment);
                        setParent(null);
                        setBody(comment.body);
                        document.getElementById("comentarios")?.scrollIntoView();
                      }}
                    >
                      Editar
                    </button>
                    <button
                      disabled={remove.isPending}
                      onClick={() => confirm("Excluir comentário?") && remove.mutate(comment.id)}
                    >
                      Excluir
                    </button>
                  </>
                )}
                <button
                  disabled={report.isPending}
                  onClick={() => requireAuth() && report.mutate(comment.id)}
                >
                  Denunciar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          Carregar mais comentários e respostas
        </Button>
      )}
    </section>
  );
}
