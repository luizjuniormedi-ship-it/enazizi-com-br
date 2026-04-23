import { ENAFLIX_BADGE_STYLES } from "@/data/enaflix/enaflixBadges";
import type { EnaflixBadge as EnaflixBadgeKey } from "@/data/enaflix/enaflixModules";
import { cn } from "@/lib/utils";

interface Props {
  type: EnaflixBadgeKey;
  className?: string;
}

export function EnaflixBadge({ type, className }: Props) {
  const cfg = ENAFLIX_BADGE_STYLES[type];
  if (!cfg) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur-sm",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
