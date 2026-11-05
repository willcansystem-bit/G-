import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useInteractions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Row = {
  id: string;
  body: string;
  created_at: string;
  is_edited: boolean;
  parent_id: string | null;
  user_id: string;
  author: { display_name: string | null; username: string | null } | null;
};

export function Comments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const qc = useQueryClient();
  const [order, setOrder] = useState<"recentes" | "antigos">("recentes");
  const key = ["comments", postId];

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id,body,created_at,is_edited,parent_id,user_id,author:profiles(display_name,username)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const add = useMutation({
    mutationFn: async ({ body, parent }: { body: string; parent?: string }) => {
      const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user!.id, body, parent_id: parent ?? null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Não foi possível comentar."),
  });
  const edit = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from("comments").update({ body }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const roots = (data ?? []).filter((c) => !c.parent_id);
  if (order === "recentes") roots.reverse();
  const replies = (id: string) => (data ?? []).filter((c) => c.parent_id === id);

  return (
    <section id="comentarios" className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Comentários {data ? `(${data.length})` : ""}</h2>
        <select
          aria-label="Ordenar comentários"
          value={order}
          onChange={(e) => setOrder(e.target.value as typeof order)}
          className="rounded-full border border-border bg-card px-3 py-1 text-sm"
        >
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
        </select>
      </div>
      <Composer
        placeholder={user ? "Escreva um comentário respeitoso…" : "Entre para comentar"}
        onFocus={() => requireAuth()}
        onSubmit={(body) => add.mutateAsync({ body })}
      />
      {isPending && <p className="py-4 text-sm text-muted-foreground">Carregando comentários…</p>}
      {isError && <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>}
      {data && roots.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Seja o primeiro a comentar.</p>}
      <ul className="mt-2">
        {roots.map((c) => (
          <CommentItem key={c.id} c={c} mine={c.user_id === user?.id} onEdit={edit.mutateAsync} onDelete={del.mutate}
            onReply={(body) => add.mutateAsync({ body, parent: c.id })} replies={replies(c.id)} userId={user?.id} requireAuth={requireAuth} />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({ c, mine, onEdit, onDelete, onReply, replies, userId, requireAuth }: {
  c: Row; mine: boolean;
  onEdit: (v: { id: string; body: string }) => Promise<unknown>;
  onDelete: (id: string) => void;
  onReply?: (body: string) => Promise<unknown>;
  replies?: Row[]; userId?: string; requireAuth: () => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const name = c.author?.display_name ?? "Leitor";
  const visible = showAll ? replies ?? [] : (replies ?? []).slice(0, 2);
  return (
    <li className="border-b border-border py-3 last:border-0">
      <div className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm"><b>{name}</b> <span className="text-muted-foreground">· {timeAgo(c.created_at)}{c.is_edited && " · editado"}</span></p>
          {editing ? (
            <Composer initial={c.body} onSubmit={async (b) => { await onEdit({ id: c.id, body: b }); setEditing(false); }} onCancel={() => setEditing(false)} />
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{c.body}</p>
          )}
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
            {onReply && <button onClick={() => requireAuth() && setReplying((v) => !v)} className="hover:text-primary">Responder</button>}
            {mine && !editing && <button onClick={() => setEditing(true)} className="hover:text-primary">Editar</button>}
            {mine && <button onClick={() => confirm("Excluir este comentário?") && onDelete(c.id)} className="hover:text-destructive">Excluir</button>}
          </div>
          {replying && onReply && <Composer placeholder="Sua resposta…" onSubmit={async (b) => { await onReply(b); setReplying(false); setShowAll(true); }} onCancel={() => setReplying(false)} />}
          {visible.length > 0 && (
            <ul className="mt-2 border-l-2 border-border pl-3">
              {visible.map((r) => <CommentItem key={r.id} c={r} mine={r.user_id === userId} onEdit={onEdit} onDelete={onDelete} requireAuth={requireAuth} />)}
            </ul>
          )}
          {!showAll && (replies?.length ?? 0) > 2 && (
            <button onClick={() => setShowAll(true)} className="mt-1 text-xs font-medium text-primary">Ver mais {replies!.length - 2} respostas</button>
          )}
        </div>
      </div>
    </li>
  );
}

function Composer({ initial = "", placeholder, onSubmit, onCancel, onFocus }: {
  initial?: string; placeholder?: string; onSubmit: (b: string) => Promise<unknown>; onCancel?: () => void; onFocus?: () => void;
}) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const text = v.trim();
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text || text.length > 1000) return;
        setBusy(true);
        try { await onSubmit(text); setV(""); } finally { setBusy(false); }
      }}
    >
      <Textarea value={v} onChange={(e) => setV(e.target.value)} onFocus={onFocus} placeholder={placeholder} maxLength={1000} rows={2} className="resize-none rounded-2xl bg-card" />
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" size="sm" className="rounded-full" disabled={!text || busy}>Publicar</Button>
      </div>
    </form>
  );
}
