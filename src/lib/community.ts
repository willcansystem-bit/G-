import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type CommunityDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] &
      Record<string, { Args: Record<string, Json>; Returns: Json }>;
  };
};

export async function community<T>(name: string, args: Record<string, Json> = {}): Promise<T> {
  const { data, error } = await (supabase as unknown as SupabaseClient<CommunityDatabase>).rpc(
    name,
    args,
  );
  if (error) throw error;
  return data as T;
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & { show_location: boolean };
export type Roles = { admin: boolean; staff: boolean };
export type PublicComment = {
  id: string;
  body: string;
  created_at: string;
  is_edited: boolean;
  parent_id: string | null;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
};
export type Conversation = {
  id: string;
  user_id: string;
  display_name: string | null;
  subject: string;
  status: string;
  updated_at: string;
  unread: number;
};
export type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  read_at: string | null;
};
export const SUBJECTS = [
  "Sugestão de pauta",
  "Correção de notícia",
  "Suporte",
  "Parceria",
  "Outro",
];
