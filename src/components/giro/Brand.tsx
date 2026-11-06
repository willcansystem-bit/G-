import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import type { Channel } from "@/lib/api";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Giro+ — início"
      className="inline-flex items-baseline font-black tracking-tight"
    >
      <span className="text-2xl text-foreground">{compact ? "G" : "Giro"}</span>
      <span className="text-2xl text-primary">+</span>
    </Link>
  );
}

export function ChannelAvatar({
  channel,
  size = 40,
}: {
  channel: Pick<Channel, "name" | "color"> | null;
  size?: number;
}) {
  const label = channel?.name.replace("G+ ", "").slice(0, 2) ?? "G+";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground ring-2 ring-background"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${channel?.color ?? "#FF6A00"}, color-mix(in oklab, ${channel?.color ?? "#FF6A00"} 55%, black))`,
      }}
    >
      {label}
    </span>
  );
}

export function Verified() {
  return (
    <BadgeCheck
      className="h-4 w-4 fill-primary text-primary-foreground"
      aria-label="Canal oficial"
    />
  );
}

export function DemoBadge() {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Demonstrativo
    </span>
  );
}
