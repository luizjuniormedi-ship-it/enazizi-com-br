import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * EnaflixBackgroundFX — fundo cinematográfico global (Fase 5).
 *
 * Camadas (todas GPU-friendly, somente opacity/transform/filter):
 *  - gradiente cinematográfico de base
 *  - medical grid sutil
 *  - holographic pulses (3 orbs)
 *  - floating particles (CSS only)
 *  - neural lines drift
 *
 * Use como fundo fixo em rotas premium (Dashboard, Tutor, Player).
 *  <EnaflixBackgroundFX intensity="medium" />
 */
export type BackgroundFXIntensity = "subtle" | "medium" | "intense";

interface Props {
  intensity?: BackgroundFXIntensity;
  className?: string;
  /** Renderiza inline (absolute) em vez de fixed */
  inline?: boolean;
}

const OPACITY: Record<BackgroundFXIntensity, number> = {
  subtle: 0.35,
  medium: 0.6,
  intense: 0.9,
};

function BackgroundFXBase({ intensity = "medium", className, inline = false }: Props) {
  const op = OPACITY[intensity];
  return (
    <div
      aria-hidden
      className={cn(
        inline ? "absolute" : "fixed",
        "inset-0 -z-10 overflow-hidden pointer-events-none",
        className,
      )}
      style={{ opacity: op }}
    >
      {/* base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 10% 0%, hsl(var(--enaflix-violet) / 0.18), transparent 55%), radial-gradient(120% 80% at 90% 100%, hsl(var(--enaflix-medical-blue) / 0.18), transparent 60%), linear-gradient(180deg, hsl(var(--enaflix-bg)) 0%, hsl(var(--enaflix-bg-soft)) 100%)",
        }}
      />

      {/* medical grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--enaflix-cyan) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--enaflix-cyan) / 0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* holographic orbs */}
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full blur-3xl enaflix-holo-pulse"
           style={{ background: "radial-gradient(circle, hsl(var(--enaflix-violet) / 0.35), transparent 70%)" }} />
      <div className="absolute top-1/3 -right-32 h-[480px] w-[480px] rounded-full blur-3xl enaflix-holo-pulse"
           style={{ background: "radial-gradient(circle, hsl(var(--enaflix-cyan) / 0.30), transparent 70%)", animationDelay: "1.4s" }} />
      <div className="absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full blur-3xl enaflix-holo-pulse"
           style={{ background: "radial-gradient(circle, hsl(var(--enaflix-mint) / 0.25), transparent 70%)", animationDelay: "2.6s" }} />

      {/* floating particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => {
          const x = (i * 53) % 100;
          const y = (i * 37) % 100;
          const delay = (i % 7) * 0.6;
          const dur = 7 + (i % 5);
          return (
            <span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/70 enaflix-float"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
                boxShadow: "0 0 8px hsl(var(--enaflix-cyan) / 0.8)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export const EnaflixBackgroundFX = memo(BackgroundFXBase);
