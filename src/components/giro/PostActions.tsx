import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, Heart, Link2, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { compact, type PostCard } from "@/lib/api";
import { useMyState } from "@/hooks/useAuth";
import { useRequireAuth, useToggleLike, useToggleSave } from "@/hooks/useInteractions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function postUrl(slug: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/noticia/${slug}`;
}

async function copyLink(slug: string) {
  await navigator.clipboard.writeText(postUrl(slug));
  toast.success("Link copiado");
}

export function PostActions({ post }: { post: PostCard }) {
  const { data: me } = useMyState();
  const requireAuth = useRequireAuth();
  const like = useToggleLike();
  const save = useToggleSave();
  const liked = me?.likes.has(post.id) ?? false;
  const saved = me?.saves.has(post.id) ?? false;
  const [baseLiked] = useState(liked);
  const [pop, setPop] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  // count from server, adjusted for changes made in this session
  const likes = post.likes_count + (liked ? 1 : 0) - (me && baseLiked ? 1 : 0);

  const share = async () => {
    if (!requireAuth()) return;
    const url = postUrl(post.slug);
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.summary, url });
      } catch {
        /* cancelado */
      }
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`,
        "_blank",
        "noopener",
      );
    }
  };

  const btn =
    "group inline-flex items-center gap-1.5 rounded-full p-2 text-sm text-muted-foreground transition-colors";

  return (
    <div className="-ml-2 mt-2 flex items-center justify-between pr-1">
      <Link
        to="/noticia/$slug"
        params={{ slug: post.slug }}
        hash="comentarios"
        className={cn(btn, "hover:bg-primary/10 hover:text-primary")}
        aria-label={`Comentários: ${post.comments_count}`}
      >
        <MessageCircle className="h-[18px] w-[18px]" />
        <span>{compact(post.comments_count)}</span>
      </Link>
      <button
        type="button"
        aria-pressed={liked}
        aria-label={liked ? "Descurtir" : "Curtir"}
        onClick={() => {
          if (!requireAuth()) return;
          if (!liked) setPop((p) => p + 1);
          like.mutate({ id: post.id, on: !liked });
        }}
        className={cn(btn, "hover:bg-like/10 hover:text-like", liked && "text-like")}
      >
        <Heart key={pop} className={cn("h-[18px] w-[18px]", liked && "fill-like animate-pop")} />
        <span>{compact(Math.max(0, likes))}</span>
      </button>
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Remover dos salvos" : "Salvar"}
        onClick={() => {
          if (!requireAuth()) return;
          save.mutate({ id: post.id, on: !saved });
          toast(saved ? "Removido dos salvos" : "Salvo");
        }}
        className={cn(btn, "hover:bg-primary/10 hover:text-primary", saved && "text-primary")}
      >
        <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-primary")} />
      </button>
      <button
        type="button"
        aria-label="Compartilhar"
        onClick={share}
        className={cn(btn, "hover:bg-primary/10 hover:text-primary")}
      >
        <Share2 className="h-[18px] w-[18px]" />
      </button>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next || requireAuth()) setMenuOpen(next);
        }}
      >
        <DropdownMenuTrigger className={cn(btn, "hover:bg-secondary")} aria-label="Mais opções">
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="glass border">
          <DropdownMenuItem
            onClick={() => {
              if (requireAuth())
                copyLink(post.slug).catch(() => toast.error("Não foi possível copiar o link."));
            }}
          >
            <Link2 className="mr-2 h-4 w-4" /> Copiar link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (requireAuth())
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(`${post.title} ${postUrl(post.slug)}`)}`,
                  "_blank",
                  "noopener",
                );
            }}
          >
            <Share2 className="mr-2 h-4 w-4" /> Enviar no WhatsApp
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
