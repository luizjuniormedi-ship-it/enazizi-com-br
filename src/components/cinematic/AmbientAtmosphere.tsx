import * as React from "react";
import { cn } from "@/lib/utils";
import type { CinematicModule } from "./CinematicCard";

const moduleHueMap: Record<CinematicModule, string> = {
  dashboard: "var(--hue-dashboard)",
  enaflix: "var(--hue-enaflix)",
  tutor: "var(--hue-tutor)",
  flashcard: "var(--hue-flashcard)",
  simulado: "var(--hue-simulado)",
  analytics: "var(--hue-analytics)",
  planner: "var(--hue-planner)",
  professor: "var(--hue-professor)",
  admin: "var(--hue-admin)",
  ranking: "var(--hue-ranking)",
};

interface AmbientAtmosphereProps {
  module: CinematicModule;
  /** Intensidade visual. */
  intensity?: "soft" | "normal" | "strong";
  /** Cobertura: full (toda a tela) ou inset (dentro do container). */
  coverage?: "full" | "inset";
  className?: string;
}

/**
 * AmbientAtmosphere — atmosfera contextual por módulo.
 *
 * Cada módulo recebe uma "personalidade" visual específica:
 *  - tutor      → partículas neurais / glow cognitivo (roxo)
 *  - simulado   → ring de tensão / energy pulse (verde performance)
 *  - enaflix    → poster reveal / streaming ambience (vermelho)
 *  - flashcard  → memory orbs / âmbar suave
 *  - analytics  → grid scan / linhas de dados (ciano)
 *  - planner    → constelação calma (magenta)
 *  - professor  → halo mentor (laranja)
 *  - admin      → grafite minimalista
 *  - ranking    → dourado celebratório
 *  - dashboard  → cockpit azul, breathing
 *
 * Uso típico (loaders, heroes, suspense fallback):
 *   <AmbientAtmosphere module="tutor" coverage="inset" />
 */
export const AmbientAtmosphere: React.FC<AmbientAtmosphereProps> = ({
  module,
  intensity = "normal",
  coverage = "inset",
  className,
}) => {
  const hue = moduleHueMap[module];
  const baseOpacity = intensity === "soft" ? 0.5 : intensity === "strong" ? 1 : 0.75;

  const positionClass =
    coverage === "full" ? "fixed inset-0" : "absolute inset-0";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none overflow-hidden",
        positionClass,
        className,
      )}
      style={{
        ["--module-hue" as never]: hue,
        opacity: baseOpacity,
      }}
    >
      {module === "tutor" && <TutorAtmosphere />}
      {module === "simulado" && <SimuladoAtmosphere />}
      {module === "enaflix" && <EnaflixAtmosphere />}
      {module === "flashcard" && <FlashcardAtmosphere />}
      {module === "analytics" && <AnalyticsAtmosphere />}
      {module === "planner" && <PlannerAtmosphere />}
      {module === "professor" && <GenericGlowAtmosphere />}
      {module === "admin" && <AdminAtmosphere />}
      {module === "ranking" && <RankingAtmosphere />}
      {module === "dashboard" && <DashboardAtmosphere />}
    </div>
  );
};

/* ============================================================
 *  Atmosferas específicas por módulo
 * ============================================================ */

const NeuralParticles: React.FC<{ count?: number }> = ({ count = 14 }) => {
  // Posições/durations determinísticas (estáveis entre renders)
  const particles = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 137.5) % 100,
        top: (i * 83.7) % 100,
        size: 2 + ((i * 7) % 4),
        delay: (i * 0.4) % 4,
        duration: 6 + ((i * 1.3) % 4),
      })),
    [count],
  );
  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: "hsl(var(--module-hue) / 0.85)",
            boxShadow: "0 0 12px hsl(var(--module-hue) / 0.7)",
            animation: `cinematic-neural-drift ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
};

const TutorAtmosphere: React.FC = () => (
  <>
    {/* Glow neural ambiente */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, hsl(var(--module-hue) / 0.18), transparent 55%), radial-gradient(ellipse at 75% 80%, hsl(var(--module-hue) / 0.12), transparent 60%)",
        filter: "blur(40px)",
        animation: "cinematic-atmosphere-pulse 6s ease-in-out infinite",
      }}
    />
    <NeuralParticles count={16} />
  </>
);

const SimuladoAtmosphere: React.FC = () => (
  <>
    {/* Energy ring de performance */}
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: "min(60vw, 600px)",
        height: "min(60vw, 600px)",
        background:
          "radial-gradient(circle, transparent 55%, hsl(var(--module-hue) / 0.16) 60%, transparent 65%)",
        filter: "blur(8px)",
        animation: "cinematic-energy-ring 5s ease-in-out infinite",
      }}
    />
    {/* Pulse de tensão controlada */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, hsl(var(--module-hue) / 0.08), transparent 70%)",
        animation: "cinematic-atmosphere-pulse 3.2s ease-in-out infinite",
      }}
    />
  </>
);

const EnaflixAtmosphere: React.FC = () => (
  <>
    {/* Vinheta cinematográfica */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, hsl(var(--module-hue) / 0.18), transparent 55%), radial-gradient(ellipse at 50% 100%, hsl(0 0% 0% / 0.5), transparent 55%)",
        filter: "blur(28px)",
      }}
    />
    {/* Streaming shimmer */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(120deg, transparent 30%, hsl(var(--module-hue) / 0.06) 50%, transparent 70%)",
        backgroundSize: "200% 100%",
        animation: "cinematic-skeleton-sweep 4s ease-in-out infinite",
      }}
    />
  </>
);

const FlashcardAtmosphere: React.FC = () => {
  const orbs = React.useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        left: 10 + ((i * 19) % 80),
        top: 15 + ((i * 23) % 70),
        size: 80 + ((i * 17) % 60),
        delay: (i * 0.7) % 3,
      })),
    [],
  );
  return (
    <>
      {orbs.map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${o.left}%`,
            top: `${o.top}%`,
            width: o.size,
            height: o.size,
            background:
              "radial-gradient(circle, hsl(var(--module-hue) / 0.18) 0%, transparent 70%)",
            filter: "blur(20px)",
            animation: `cinematic-memory-orb 7s ease-in-out ${o.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
};

const AnalyticsAtmosphere: React.FC = () => (
  <>
    {/* Grid scan lines suaves */}
    <div
      className="absolute inset-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, hsl(var(--module-hue) / 0.05) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--module-hue) / 0.05) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage:
          "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
    {/* Scan line vertical em movimento */}
    <div
      className="absolute inset-y-0"
      style={{
        left: 0,
        width: "200px",
        background:
          "linear-gradient(to right, transparent, hsl(var(--module-hue) / 0.18), transparent)",
        animation: "cinematic-scan-x 8s linear infinite",
        filter: "blur(2px)",
      }}
    />
  </>
);

const PlannerAtmosphere: React.FC = () => {
  const stars = React.useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: (i * 53) % 100,
        top: (i * 71) % 100,
        size: 1 + ((i * 3) % 3),
        delay: (i * 0.3) % 4,
      })),
    [],
  );
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, hsl(var(--module-hue) / 0.1), transparent 60%)",
          filter: "blur(40px)",
        }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: "hsl(var(--module-hue) / 0.85)",
            boxShadow: "0 0 6px hsl(var(--module-hue) / 0.6)",
            animation: `cinematic-star-twinkle 4s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
};

const AdminAtmosphere: React.FC = () => (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 50% 0%, hsl(var(--module-hue) / 0.08), transparent 50%)",
      filter: "blur(32px)",
    }}
  />
);

const RankingAtmosphere: React.FC = () => (
  <>
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, hsl(var(--module-hue) / 0.16), transparent 55%)",
        filter: "blur(36px)",
        animation: "cinematic-atmosphere-pulse 5s ease-in-out infinite",
      }}
    />
    {/* Glints dourados */}
    <NeuralParticles count={10} />
  </>
);

const DashboardAtmosphere: React.FC = () => (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 20% 20%, hsl(var(--module-hue) / 0.14), transparent 55%), radial-gradient(ellipse at 80% 80%, hsl(var(--accent) / 0.08), transparent 60%)",
      filter: "blur(36px)",
      animation: "cinematic-atmosphere-pulse 7s ease-in-out infinite",
    }}
  />
);

const GenericGlowAtmosphere: React.FC = () => (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 50% 30%, hsl(var(--module-hue) / 0.14), transparent 55%)",
      filter: "blur(36px)",
      animation: "cinematic-atmosphere-pulse 6s ease-in-out infinite",
    }}
  />
);
