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
    <div className={cn("relative z-20", className)} aria-hidden>
      <MascotAvatar 
        state="idle" 
        size={size === "sm" ? "md" : size === "lg" ? "xl" : "lg"} 
      />
    </div>
  );
}
