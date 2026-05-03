import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { EnaflixModule } from "@/data/enaflix/enaflixModules";
import { EnaflixBillboard } from "./EnaflixBillboard";

interface Props {
  /** Lista de módulos a alternar no billboard (ordem importa) */
  modules: Array<{ module: EnaflixModule; eyebrow: string; customTitle?: string; customDesc?: string }>;
  /** Intervalo de rotação em ms (0 desativa) */
  intervalMs?: number;
  onNavigate?: (m: EnaflixModule) => void;
}

/**
 * EnaflixBillboardRotator — vitrine cinematográfica rotativa.
 *
 * Envolve o EnaflixBillboard existente com:
 *  - Cross-fade entre destaques (sem reset visual brusco)
 *  - Indicadores de progresso (clicáveis) na base
 *  - Auto-rotate a cada `intervalMs` (default 9s, gentil)
 *  - Pausa no hover/focus
 *  - Respeita prefers-reduced-motion (sem auto-rotate)
 *
 * Mantém zero alteração no Billboard original — apenas orquestra a troca.
 */
export function EnaflixBillboardRotator({ modules, intervalMs = 9000, onNavigate }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || intervalMs === 0 || reducedMotion.current) return;
    if (modules.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % modules.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [paused, intervalMs, modules.length]);

  if (modules.length === 0) return null;

  // Caso único — render direto, sem indicadores
  if (modules.length === 1) {
    return (
      <EnaflixBillboard
        module={modules[0].module}
        eyebrow={modules[0].eyebrow}
        customTitle={modules[0].customTitle}
        customDesc={modules[0].customDesc}
        onNavigate={onNavigate}
      />
    );
  }

  const active = modules[activeIdx];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative"
    >
      {/* Cross-fade: re-monta o Billboard com key, animações internas re-disparam */}
      <div key={`bb-${activeIdx}`} className="animate-fade-in">
        <EnaflixBillboard
          module={active.module}
          eyebrow={active.eyebrow}
          onNavigate={onNavigate}
        />
      </div>

      {/* Indicadores de progresso (Netflix-style) — flutuantes na base do hero */}
      <div className="pointer-events-none absolute bottom-24 sm:bottom-32 inset-x-0 z-30 flex justify-center sm:justify-start sm:px-14">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10">
          {modules.map((m, i) => (
            <button
              key={m.module.id}
              type="button"
              aria-label={`Ver destaque ${i + 1}: ${m.module.title}`}
              aria-current={i === activeIdx}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === activeIdx
                  ? "w-10 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
