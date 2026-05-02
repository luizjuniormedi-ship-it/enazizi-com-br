import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * EnaflixLoader — spinner holográfico médico (Fase 5).
 *
 * Variantes:
 *  - default: anel cinético violeta/ciano
 *  - hologram: pulso médico com cruz central
 *  - dots: três pontos pulsantes
 */
interface Props {
  variant?: "default" | "hologram" | "dots";
  size?: number;
  label?: string;
  className?: string;
}

function LoaderBase({ variant = "default", size = 48, label, className }: Props) {
  return (
    <div
      role="status"
      aria-label={label ?? "Carregando"}
      className={cn("flex flex-col items-center gap-3", className)}
    >
      {variant === "default" && (
        <div className="relative" style={{ width: size, height: size }}>
          <span
            className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
            style={{
              borderTopColor: "hsl(var(--enaflix-cyan))",
              borderRightColor: "hsl(var(--enaflix-violet))",
              filter: "drop-shadow(0 0 12px hsl(var(--enaflix-violet) / 0.6))",
            }}
          />
          <span className="absolute inset-2 rounded-full enaflix-holo-pulse"
                style={{ background: "radial-gradient(circle, hsl(var(--enaflix-cyan) / 0.5), transparent 70%)" }}
          />
        </div>
      )}

      {variant === "hologram" && (
        <div className="relative pixar-breathe" style={{ width: size, height: size }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, hsl(var(--enaflix-mint) / 0.45), transparent 70%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="block h-1/2 w-[6px] rounded-full bg-white/90" />
            <span className="absolute block h-[6px] w-1/2 rounded-full bg-white/90" />
          </div>
        </div>
      )}

      {variant === "dots" && (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full enaflix-holo-pulse"
              style={{
                background: "hsl(var(--enaflix-cyan))",
                boxShadow: "0 0 10px hsl(var(--enaflix-cyan) / 0.7)",
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      )}

      {label && (
        <span className="enaflix-hud-label opacity-80">{label}</span>
      )}
    </div>
  );
}

export const EnaflixLoader = memo(LoaderBase);
