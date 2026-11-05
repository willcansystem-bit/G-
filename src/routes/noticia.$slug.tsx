import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Users } from "lucide-react";
import { fetchPost, fetchPosts, fullDate } from "@/lib/api";
import { postImage } from "@/lib/images";
import { ChannelAvatar, DemoBadge, Verified } from "@/components/giro/Brand";
import { PostActions } from "@/components/giro/PostActions";
import { PostItem } from "@/components/giro/PostItem";
import { Comments } from "@/components/giro/Comments";

type Recipe = { rendimento?: string; tempo?: string; ingredientes?: string[]; preparo?: string[] };

export const Route = createFileRoute("/noticia/$slug")({
  loader: async ({ params }) => {
    const post = await fetchPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post;
    const title = p ? `${p.title} — Giro+` : "Notícia indisponível — Giro+";
    const desc = p?.summary ?? "Notícia do Giro+";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(p ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: PostPage,
});

function PostPage() {
  const { post } = Route.useLoaderData();
  const img = postImage(post.image_key);
  const recipe = post.recipe as Recipe | null;
  const sources = (post.sources as { label: string; url: string }[]) ?? [];
  const related = useQuery({
    queryKey: ["related", post.id],
    queryFn: async () => (await fetchPosts({ channelIds: [post.channel_id], limit: 4 })).filter((p) => p.id !== post.id).slice(0, 3),
  });

  return (
    <article>
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-4 border-b px-4">
        <button onClick={() => history.length > 1 ? history.back() : (location.href = "/")} aria-label="Voltar" className="rounded-full p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold">Notícia</span>
      </header>
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <ChannelAvatar channel={post.channel} size={44} />
          <div className="text-sm">
            <Link to="/canal/$slug" params={{ slug: post.channel?.slug ?? "" }} className="flex items-center gap-1 font-semibold hover:underline">
              {post.channel?.name} <Verified />
            </Link>
            <p className="text-muted-foreground">Por {post.author_name}</p>
          </div>
          <div className="ml-auto flex gap-1.5">
            {post.is_urgent && <span className="rounded-full bg-urgent px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Urgente</span>}
            {post.is_demo && <DemoBadge />}
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">{post.title}</h1>
        {post.subtitle && <p className="mt-2 text-lg text-muted-foreground">{post.subtitle}</p>}
        <p className="mt-3 text-xs text-muted-foreground">
          Publicado em {fullDate(post.published_at)}
          {post.updated_at > post.published_at && <> · Atualizado em {fullDate(post.updated_at)}</>}
          {post.city && <> · {post.city}/{post.state}</>}
        </p>
      </div>
      {img && (
        <figure className="mt-4 px-4">
          <img src={img} alt={post.image_alt ?? ""} width={1280} height={720} className="aspect-video w-full rounded-2xl border border-border object-cover" />
          {post.image_credit && <figcaption className="mt-1 text-xs text-muted-foreground">{post.image_credit}</figcaption>}
        </figure>
      )}
      <div className="px-4 py-5 text-[17px] leading-8 text-foreground/90">
        {post.body.split("\n\n").map((para, i) => <p key={i} className="mb-4">{para}</p>)}

        {recipe && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex gap-6 text-sm text-muted-foreground">
              {recipe.tempo && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />{recipe.tempo}</span>}
              {recipe.rendimento && <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />{recipe.rendimento}</span>}
            </div>
            <h2 className="text-lg font-bold">Ingredientes</h2>
            <ul className="mb-4 mt-2 list-disc space-y-1 pl-5 text-base">{recipe.ingredientes?.map((x) => <li key={x}>{x}</li>)}</ul>
            <h2 className="text-lg font-bold">Modo de preparo</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-base">{recipe.preparo?.map((x) => <li key={x}>{x}</li>)}</ol>
          </section>
        )}

        {sources.length > 0 && (
          <section className="mt-6">
            <h2 className="text-base font-bold">Fontes</h2>
            <ul className="mt-1 text-sm">{sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{s.label}</a></li>)}</ul>
          </section>
        )}
        {post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {post.tags.map((t) => <Link key={t} to="/explorar" search={{ q: t }} className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">#{t}</Link>)}
          </div>
        )}
      </div>
      <div className="border-y border-border px-4 pb-1">
        <PostActions post={post} />
      </div>

      <Comments postId={post.id} />

      {related.data && related.data.length > 0 && (
        <section className="mt-2 border-t border-border">
          <h2 className="px-4 pt-4 text-lg font-bold">Relacionadas</h2>
          {related.data.map((p) => <PostItem key={p.id} post={p} />)}
        </section>
      )}
    </article>
  );
}
