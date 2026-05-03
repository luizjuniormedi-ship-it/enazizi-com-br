import * as React from "react";
import tutorAvatar from "@/assets/tutor-avatar-hd.png";
import { cn } from "@/lib/utils";

/**
 * TutorThinkingIndicator — loading cinematográfico do Tutor IA.
 *
 * Substitui os "3 bouncing dots" genéricos por uma cena de "mentor pensando":
 *  - Avatar com halo neural respirando (hue-tutor)
 *  - Anel orbital com 3 partículas neurais girando
 *  - Bubble com shimmer sweep + texto contextual rotativo
 *  - Tudo em GPU (transform/opacity)
 *  - Respeita prefers-reduced-motion
 */
const THINKING_LABELS = [
  "Conectando à base ENAFLIX...",
  "Analisando fisiopatologia...",
  "Buscando raciocínio clínico...",
  "Cruzando diagnósticos...",
  "Consultando fontes PubMed...",
  "Preparando roteiro pedagógico...",
];

export const TutorThinkingIndicator: React.FC = () => {
  const [labelIdx, setLabelIdx] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;
    }
    const id = window.setInterval(() => {
      setLabelIdx((i) => (i + 1) % THINKING_LABELS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex gap-2 sm:gap-3 animate-fade-in items-start">
      {/* Avatar com halo neural respirando */}
      <div className="relative flex-shrink-0">
        {/* Halo respirando externo */}
        <div
          aria-hidden
          className="absolute -inset-2 rounded-2xl blur-xl opacity-70 animate-cinematic-pulse-core"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--hue-tutor) / 0.55), transparent 70%)",
          }}
        />

        {/* Anel orbital com 3 partículas neurais */}
        <div
          aria-hidden
          className="absolute inset-0 -m-2 motion-safe:animate-[tutor-orbit_4s_linear_infinite]"
          style={{ transformOrigin: "center" }}
        >
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                background: "hsl(var(--hue-tutor))",
                boxShadow: "0 0 10px hsl(var(--hue-tutor) / 0.9)",
                transform: `rotate(${deg}deg) translateY(-22px)`,
              }}
            />
          ))}
        </div>

        {/* Avatar */}
        <div
          className={cn(
            "relative h-12 w-9 sm:h-14 sm:w-11 rounded-xl overflow-hidden",
            "ring-1 ring-white/15",
            "shadow-[0_8px_24px_-6px_hsl(var(--hue-tutor)/0.6)]",
          )}
          style={{ animation: "float 4s ease-in-out infinite" }}
        >
          <img
            src={tutorAvatar}
            alt="Tutor pensando"
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* Bubble com shimmer + texto contextual */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl px-4 py-3",
          "bg-secondary/60 backdrop-blur-md border border-white/[0.08]",
          "min-w-[180px]",
        )}
      >
        {/* Shimmer sweep */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 motion-safe:animate-cinematic-skeleton-sweep"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, hsl(var(--hue-tutor) / 0.18) 50%, transparent 70%)",
          }}
        />

        {/* Glow inferior sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, hsl(var(--hue-tutor) / 0.25), transparent 70%)",
          }}
        />

        <div className="relative flex flex-col gap-1">
          <div className="flex items-center gap-2">

          {/* 3 dots respirando, mas mais elegantes */}
          <div className="flex gap-1.5 items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full motion-safe:animate-bounce"
                style={{
                  background: "hsl(var(--hue-tutor))",
                  boxShadow: "0 0 6px hsl(var(--hue-tutor) / 0.8)",
                  animationDelay: `${i * 160}ms`,
                  animationDuration: "1.2s",
                }}
              />
            ))}
          </div>

          {/* Label rotativo */}
          <span
            key={labelIdx}
            className="text-xs sm:text-sm font-medium text-foreground/85 motion-safe:animate-fade-in"
          >
            {THINKING_LABELS[labelIdx]}
          </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground/60 font-mono tracking-tighter">
              Buscando no PubMed...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorThinkingIndicator;
