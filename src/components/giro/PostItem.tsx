import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { timeAgo, type PostCard } from "@/lib/api";
import { postImage } from "@/lib/images";
import { ChannelAvatar, DemoBadge, Verified } from "./Brand";
import { PostActions } from "./PostActions";
import { FollowButton } from "./FollowButton";

export function PostItem({
  post,
  showFollow,
}: {
  post: PostCard;
  showFollow?: boolean | undefined;
}) {
  const img = postImage(post.image_key);
  return (
    <article className="relative border-b border-border px-4 py-3 transition-colors hover:bg-secondary/40">
      <div className="flex gap-3">
        <Link
          to="/canal/$slug"
          params={{ slug: post.channel?.slug ?? "" }}
          className="relative z-10 h-fit"
        >
          <ChannelAvatar channel={post.channel} />
        </Link>
        <div className="min-w-0 flex-1">
          <div
            className={`relative flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm ${showFollow ? "min-h-8 pr-24" : ""}`}
          >
            <Link
              to="/canal/$slug"
              params={{ slug: post.channel?.slug ?? "" }}
              className="relative z-10 font-semibold text-foreground hover:underline"
            >
              {post.channel?.name}
            </Link>
            <Verified />
            {showFollow && (
              <span className="absolute right-0 top-0 z-10">
                <FollowButton channelId={post.channel_id} small onlyUnfollowed />
              </span>
            )}
            <span className="text-muted-foreground">·</span>
            <time dateTime={post.published_at} className="text-muted-foreground">
              {timeAgo(post.published_at)}
            </time>
            {post.is_urgent && (
              <span className="rounded-full bg-urgent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                Urgente
              </span>
            )}
            {post.is_demo && <DemoBadge />}
          </div>
          <Link
            to="/noticia/$slug"
            params={{ slug: post.slug }}
            className="mt-1 block after:absolute after:inset-0"
          >
            <h2 className="text-[17px] font-bold leading-snug text-foreground">{post.title}</h2>
          </Link>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{post.summary}</p>
          {img && (
            <img
              src={img}
              alt={post.image_alt ?? ""}
              loading="lazy"
              width={1280}
              height={720}
              className="mt-3 aspect-video w-full rounded-2xl border border-border object-cover"
            />
          )}
          {(post.tags.length > 0 || post.city) && (
            <div className="relative z-10 mt-2 flex flex-wrap gap-1.5 text-xs">
              {post.city && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {post.city}/{post.state}
                </span>
              )}
              {post.tags.map((t) => (
                <span key={t} className="text-primary">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="relative z-10">
            <PostActions post={post} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-4" aria-hidden>
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
