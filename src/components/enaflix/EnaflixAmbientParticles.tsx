/**
 * EnaflixAmbientParticles — partículas estáticas (CSS puro) flutuando no fundo.
 *
 * NÃO usa JavaScript / NÃO observa scroll / NÃO consome RAF.
 * Renderiza ~20 dots posicionados deterministicamente que sobem lentamente
 * em loop infinito com delays escalonados — efeito Disney+/Pixar discreto
 * de "ar mágico" no fundo da página.
 *
 * pointer-events: none e aria-hidden — puro decorativo.
 * Respeita prefers-reduced-motion via classe global no index.css.
 */
import { useMemo } from "react";

interface Props {
  /** Densidade — quantas partículas renderizar (default 20) */
  count?: number;
  /** Cor base (semantic) — primary | violet | amber | emerald */
  hue?: "primary" | "violet" | "amber" | "emerald" | "mixed";
}

const HUE_MAP: Record<NonNullable<Props["hue"]>, string[]> = {
  primary: ["hsl(var(--primary)/0.55)"],
  violet: ["hsl(262 83% 58% / 0.55)"],
  amber: ["hsl(38 92% 50% / 0.55)"],
  emerald: ["hsl(160 84% 39% / 0.55)"],
  mixed: [
    "hsl(var(--primary)/0.55)",
    "hsl(262 83% 58% / 0.45)",
    "hsl(199 89% 48% / 0.45)",
    "hsl(330 81% 60% / 0.4)",
  ],
};

export function EnaflixAmbientParticles({ count = 20, hue = "mixed" }: Props) {
  const palette = HUE_MAP[hue];

  // Posições determinísticas para evitar reflow entre renders
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      // Hash simples para variação determinística
      const seed = (i * 9301 + 49297) % 233280;
      const left = (seed % 100);
      const size = 1 + (seed % 4);
      const delay = (seed % 80) / 10; // 0–8s
      const duration = 14 + (seed % 12); // 14–26s
      const colorIdx = seed % palette.length;
      const opacity = 0.3 + ((seed % 50) / 100); // 0.3–0.8
      return { left, size, delay, duration, color: palette[colorIdx], opacity, key: i };
    });
  }, [count, palette]);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {particles.map((p) => (
        <span
          key={p.key}
          className="absolute bottom-0 rounded-full enaflix-particle-rise"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
