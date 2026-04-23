import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentAccent } from "./AgentPosterCard";

export interface SpotlightAgent {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent: AgentAccent;
  eyebrow: string;
}

interface Props {
  agents: SpotlightAgent[];
  /** Intervalo de auto-rotate em ms (0 desativa) */
  intervalMs?: number;
}

const ACCENT_GLOW: Record<AgentAccent, string> = {
  primary: "from-primary/40 via-primary/10",
  warning: "from-amber-500/40 via-amber-500/10",
  success: "from-emerald-500/40 via-emerald-500/10",
  destructive: "from-red-500/40 via-red-500/10",
  info: "from-sky-500/40 via-sky-500/10",
  purple: "from-violet-500/40 via-violet-500/10",
  pink: "from-pink-500/40 via-pink-500/10",
  amber: "from-amber-500/40 via-amber-500/10",
  rose: "from-rose-500/40 via-rose-500/10",
  teal: "from-teal-500/40 via-teal-500/10",
  violet: "from-violet-500/40 via-violet-500/10",
};

const ACCENT_ICON: Record<AgentAccent, string> = {
  primary: "text-primary",
  warning: "text-amber-300",
  success: "text-emerald-300",
  destructive: "text-red-300",
  info: "text-sky-300",
  purple: "text-violet-300",
  pink: "text-pink-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  teal: "text-teal-300",
  violet: "text-violet-300",
};

/**
 * AgentSpotlight — billboard rotativo cinematográfico para destaque de agentes.
 *
 * Inspiração: Netflix billboard + Apple TV spotlight + Disney+ feature row.
 *
 * Comportamento:
 *  - Rotação automática a cada 7s (pausa no hover)
 *  - Cross-fade entre agentes (sem reset visual)
 *  - Indicadores de progresso com fill animado
 *  - Cada agente carrega seu accent (glow + halo)
 *  - Respeita prefers-reduced-motion (sem auto-rotate)
 */
export function AgentSpotlight({ agents, intervalMs = 7000 }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || intervalMs === 0 || reducedMotion.current) return;
    if (agents.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % agents.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, agents.length]);

  if (agents.length === 0) return null;

  const active = agents[activeIdx];
  const Icon = active.icon;
  const glow = ACCENT_GLOW[active.accent];
  const iconColor = ACCENT_ICON[active.accent];

  return (
    <section
      aria-label="Agente em destaque"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        "relative overflow-hidden rounded-3xl isolate",
        "min-h-[320px] sm:min-h-[380px]",
        "bg-[#0a0a12] border border-white/[0.08]",
      )}
    >
      {/* Glow base por accent — cross-fade ao trocar */}
      <div
        key={`glow-${activeIdx}`}
        aria-hidden
        className={cn(
          "absolute inset-0 bg-gradient-radial blur-3xl opacity-0",
          "animate-text-reveal",
          glow,
          "to-transparent",
        )}
        style={{
          backgroundImage: `radial-gradient(circle at 75% 35%, var(--tw-gradient-stops))`,
        }}
      />

      {/* Vinheta esquerda → direita para legibilidade */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0a0a12] via-[#0a0a12]/80 via-50% to-transparent"
      />

      {/* Vinheta inferior */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a12] to-transparent"
      />

      {/* Noise overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Ícone gigante flutuante (lado direito) */}
      <div
        key={`icon-${activeIdx}`}
        aria-hidden
        className="absolute right-4 sm:right-12 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center opacity-0 animate-text-reveal"
        style={{ animationDelay: "200ms" }}
      >
        <div
          className={cn(
            "h-40 w-40 lg:h-52 lg:w-52 rounded-[2rem] flex items-center justify-center",
            "bg-white/[0.06] backdrop-blur-md border border-white/[0.12]",
            "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]",
          )}
          style={{ animation: `float 7s ease-in-out infinite` }}
        >
          <Icon className={cn("h-20 w-20 lg:h-24 lg:w-24 drop-shadow-2xl", iconColor)} />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="relative h-full flex flex-col justify-end p-6 sm:p-10 lg:p-14 z-10">
        <div className="max-w-2xl space-y-4">
          <div
            key={`eb-${activeIdx}`}
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-[0.25em] font-bold text-white/70 opacity-0 animate-text-reveal"
            style={{ animationDelay: "100ms" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{active.eyebrow}</span>
          </div>

          <h2
            key={`t-${activeIdx}`}
            className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[0.95] drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] opacity-0 animate-text-reveal"
            style={{ animationDelay: "260ms" }}
          >
            {active.title}
          </h2>

          <p
            key={`d-${activeIdx}`}
            className="text-sm sm:text-base text-white/80 leading-relaxed max-w-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] opacity-0 animate-text-reveal"
            style={{ animationDelay: "400ms" }}
          >
            {active.description}
          </p>

          <div
            key={`cta-${activeIdx}`}
            className="flex items-center gap-3 pt-2 opacity-0 animate-text-reveal"
            style={{ animationDelay: "540ms" }}
          >
            <Link
              to={active.to}
              className={cn(
                "inline-flex items-center gap-2.5 px-6 py-3 rounded-md",
                "bg-white text-black font-bold text-sm sm:text-base",
                "hover:bg-white/95 transition-colors duration-200",
                "shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]",
              )}
            >
              <Play className="h-4 w-4 fill-black" />
              <span>Iniciar agente</span>
            </Link>
          </div>
        </div>

        {/* Indicadores */}
        {agents.length > 1 && (
          <div className="absolute bottom-4 right-6 sm:bottom-6 sm:right-10 flex items-center gap-1.5 z-20">
            {agents.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Mostrar agente ${i + 1}`}
                onClick={() => setActiveIdx(i)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === activeIdx
                    ? "w-8 bg-white"
                    : "w-1.5 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
