import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"] & {
  channel: Pick<Channel, "id" | "slug" | "name" | "color"> | null;
};
export type PostCard = Pick<
  Post,
  | "id"
  | "slug"
  | "channel_id"
  | "title"
  | "summary"
  | "image_key"
  | "image_alt"
  | "is_urgent"
  | "is_demo"
  | "published_at"
  | "city"
  | "state"
  | "tags"
  | "likes_count"
  | "comments_count"
  | "channel"
>;
export type FeedTab = "para-voce" | "ultimas";

export const PAGE_SIZE = 8;
export const GUEST_POST_LIMIT = 5;
const POST_SELECT = "*, channel:channels!inner(id,slug,name,color,status)";

export async function fetchGuestPosts(): Promise<PostCard[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id,slug,channel_id,title,summary,image_key,image_alt,is_urgent,is_demo,published_at,city,state,tags,likes_count,comments_count,channel:channels!inner(id,slug,name,color,status)",
    )
    .eq("status", "published")
    .eq("channel.status", "active")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(GUEST_POST_LIMIT);
  if (error) throw error;
  return data as unknown as PostCard[];
}

export async function fetchChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("status", "active")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function fetchChannel(slug: string): Promise<Channel | null> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cursor = ISO published_at of the last item already shown. */
export async function fetchPosts(opts: {
  cursor?: string | null;
  channelIds?: string[] | undefined;
  limit?: number;
}): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .eq("channel.status", "active")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(opts.limit ?? PAGE_SIZE);
  if (opts.cursor) {
    const [publishedAt, id] = opts.cursor.split("|");
    q = id
      ? q.or(`published_at.lt.${publishedAt},and(published_at.eq.${publishedAt},id.lt.${id})`)
      : q.lt("published_at", publishedAt!);
  }
  if (opts.channelIds) {
    if (opts.channelIds.length === 0) return [];
    q = q.in("channel_id", opts.channelIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Post[];
}

export async function fetchPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Post | null;
}

export async function searchPosts(
  term: string,
  channelId?: string,
  sinceDays?: number,
): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  const t = term.trim().replace(/[%,()]/g, " ");
  if (t) q = q.or(`title.ilike.%${t}%,summary.ilike.%${t}%,tags.cs.{${t.toLowerCase()}}`);
  if (channelId) q = q.eq("channel_id", channelId);
  if (sinceDays)
    q = q.gte("published_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Post[];
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

export function compact(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
}
