import { cn } from "@/lib/utils";
import { MascotAvatar } from "../mascot/MascotAvatar";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * FloatingMascot — mascote ENAZIZI em modo flutuante decorativo.
 * Usa keyframe `float` global do tailwind config.
 */
export function FloatingMascot({ className, size = "md" }: Props) {
  const dim =
    size === "sm" ? "h-20 w-20" : size === "lg" ? "h-40 w-40 sm:h-48 sm:w-48" : "h-28 w-28 sm:h-32 sm:w-32";

  return (
    <div className={cn("relative pointer-events-none select-none", dim, className)} aria-hidden>
      {/* Glow ambiental atrás do mascote */}
      <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/40 via-violet-500/30 to-fuchsia-500/20 blur-3xl opacity-70" />
      <img
        src={ENAFLIX_MASCOT}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] animate-[float_6s_ease-in-out_infinite]"
      />
    </div>
  );
}
