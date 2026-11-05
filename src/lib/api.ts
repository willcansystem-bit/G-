import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"] & {
  channel: Pick<Channel, "id" | "slug" | "name" | "color"> | null;
};
export type FeedTab = "para-voce" | "seguindo" | "ultimas";

export const PAGE_SIZE = 8;
const POST_SELECT = "*, channel:channels(id,slug,name,color)";

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
  const { data, error } = await supabase.from("channels").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

/** Cursor = ISO published_at of the last item already shown. */
export async function fetchPosts(opts: {
  cursor?: string | null;
  channelIds?: string[];
  limit?: number;
}): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? PAGE_SIZE);
  if (opts.cursor) q = q.lt("published_at", opts.cursor);
  if (opts.channelIds) {
    if (opts.channelIds.length === 0) return [];
    q = q.in("channel_id", opts.channelIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Post[];
}

/**
 * "Para você": explicable score — posts from interests/followed channels get +2,
 * featured +1, urgent +1, minus 1 point per 12h of age. No AI.
 */
export function scoreForYou(post: Post, preferred: Set<string>, now = Date.now()): number {
  const ageH = (now - new Date(post.published_at).getTime()) / 3_600_000;
  let s = -ageH / 12;
  if (preferred.has(post.channel_id)) s += 2;
  if (post.is_featured) s += 1;
  if (post.is_urgent) s += 1;
  return s;
}

export async function fetchPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabase.from("posts").select(POST_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as unknown as Post | null;
}

export async function searchPosts(term: string, channelId?: string, sinceDays?: number): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(30);
  const t = term.trim().replace(/[%,()]/g, " ");
  if (t) q = q.or(`title.ilike.%${t}%,summary.ilike.%${t}%,tags.cs.{${t.toLowerCase()}}`);
  if (channelId) q = q.eq("channel_id", channelId);
  if (sinceDays) q = q.gte("published_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
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
