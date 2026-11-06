import { supabase } from "@/integrations/supabase/client";

export function UserAvatar({
  url,
  name,
}: {
  url?: string | null | undefined;
  name?: string | null | undefined;
}) {
  const source =
    url &&
    (/^https?:\/\//.test(url)
      ? url
      : supabase.storage.from("avatars").getPublicUrl(url).data.publicUrl);
  return source ? (
    <img
      src={source}
      alt={`Foto de ${name ?? "leitor"}`}
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-label="Avatar padrão"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-bold"
    >
      {(name ?? "Leitor").slice(0, 1).toUpperCase()}
    </span>
  );
}
