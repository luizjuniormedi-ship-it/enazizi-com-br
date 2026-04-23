import * as React from "react";
import { cn } from "@/lib/utils";
import type { CinematicModule } from "./CinematicCard";

/**
 * ModuleScene — a "alma" cinematográfica de cada módulo durante carregamento.
 *
 * Diferente do AmbientAtmosphere (background ambiente), o ModuleScene é o
 * **conteúdo central** do loader: o gesto que conta o que o módulo está fazendo.
 *
 *  - tutor      → holographic neural processing (avatar + órbitas + sinapses)
 *  - simulado   → HUD scan (cross-hair, varredura, métrica de tensão)
 *  - flashcard  → memory cards flutuando (3 cards 3D em respiração)
 *  - planner    → constelação estratégica (nós + linhas pulsando)
 *  - analytics  → órbitas de dados (3 anéis concêntricos rotacionando)
 *  - enaflix    → spotlight cinematográfico (cone de luz + frames)
 *  - professor  → mentorship grid (3 avatares conectados)
 *  - admin      → operations center (radar varredura)
 *  - ranking    → trophy glints (estrelas douradas)
 *  - dashboard  → cockpit breathing (concentric pulse)
 *
 * Importante: as cenas NÃO renderizam AmbientAtmosphere — o
 * AmbientPersistenceLayer global já cobre o background, garantindo
 * continuidade emocional entre rotas.
 */

interface ModuleSceneProps {
  module: CinematicModule;
  size?: number;
  className?: string;
  /** Texto contextual abaixo da cena (rotaciona se array). */
  hint?: string | string[];
}

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

const defaultHints: Record<CinematicModule, string[]> = {
  tutor: [
    "Conectando sinapses…",
    "Estruturando raciocínio clínico…",
    "Preparando o mentor…",
  ],
  simulado: [
    "Calibrando simulado…",
    "Analisando padrão de banca…",
    "Carregando arena…",
  ],
  flashcard: [
    "Recuperando memórias…",
    "Reorganizando cards…",
    "Preparando revisão…",
  ],
  planner: [
    "Traçando rota estratégica…",
    "Sincronizando cronograma…",
    "Calculando próximas ações…",
  ],
  analytics: [
    "Computando métricas…",
    "Cruzando indicadores…",
    "Renderizando insights…",
  ],
  enaflix: [
    "Carregando vitrine…",
    "Curadoria em andamento…",
    "Preparando experiência…",
  ],
  professor: [
    "Carregando painel do mentor…",
    "Sincronizando alunos…",
    "Preparando turma…",
  ],
  admin: [
    "Acessando centro de operações…",
    "Carregando telemetria…",
    "Sincronizando sistema…",
  ],
  ranking: ["Calculando posições…", "Atualizando conquistas…"],
  dashboard: [
    "Sincronizando cockpit…",
    "Calculando próximas ações…",
    "Carregando sua jornada…",
  ],
};

export const ModuleScene: React.FC<ModuleSceneProps> = ({
  module,
  size = 120,
  className,
  hint,
}) => {
  const hue = moduleHueMap[module];
  const hints = React.useMemo(() => {
    if (Array.isArray(hint)) return hint;
    if (typeof hint === "string") return [hint];
    return defaultHints[module];
  }, [hint, module]);

  const [hintIdx, setHintIdx] = React.useState(0);
  React.useEffect(() => {
    if (hints.length <= 1) return;
    const id = window.setInterval(() => {
      setHintIdx((i) => (i + 1) % hints.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [hints.length]);

  const style: React.CSSProperties = {
    ["--module-hue" as never]: hue,
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-4",
        className,
      )}
      style={style}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {module === "tutor" && <TutorScene size={size} />}
        {module === "simulado" && <SimuladoScene size={size} />}
        {module === "flashcard" && <FlashcardScene size={size} />}
        {module === "planner" && <PlannerScene size={size} />}
        {module === "analytics" && <AnalyticsScene size={size} />}
        {module === "enaflix" && <EnaflixScene size={size} />}
        {module === "professor" && <ProfessorScene size={size} />}
        {module === "admin" && <AdminScene size={size} />}
        {module === "ranking" && <RankingScene size={size} />}
        {module === "dashboard" && <DashboardScene size={size} />}
      </div>

      {hints[hintIdx] && (
        <p
          key={hintIdx}
          className="animate-fade-in text-xs uppercase tracking-[0.22em] text-muted-foreground/80"
        >
          {hints[hintIdx]}
        </p>
      )}
    </div>
  );
};

/* ============================================================
 * Cenas individuais
 * ============================================================ */

const CoreHalo: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
  <div
    aria-hidden
    className="absolute inset-0 rounded-full blur-2xl"
    style={{
      background:
        "radial-gradient(circle, hsl(var(--module-hue) / 0.85) 0%, transparent 70%)",
      animation: `cinematic-skeleton-breath 2.4s ease-in-out ${delay}s infinite`,
    }}
  />
);

/** TUTOR — neural holographic */
const TutorScene: React.FC<{ size: number }> = ({ size }) => {
  const orbits = [0, 1, 2];
  return (
    <>
      <CoreHalo />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: "30%",
          background:
            "radial-gradient(circle, hsl(var(--module-hue)) 0%, hsl(var(--module-hue) / 0.3) 60%, transparent 100%)",
          boxShadow: "0 0 40px hsl(var(--module-hue) / 0.6)",
          animation: "cinematic-pulse-core 1.8s ease-in-out infinite",
        }}
      />
      {orbits.map((i) => {
        const orbitSize = size * (0.6 + i * 0.2);
        return (
          <div
            key={i}
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: orbitSize,
              height: orbitSize,
              border: "1px solid hsl(var(--module-hue) / 0.18)",
              animation: `tutor-orbit ${6 + i * 2}s linear ${i * 0.4}s infinite`,
            }}
          >
            <span
              className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: 6,
                height: 6,
                background: "hsl(var(--module-hue))",
                boxShadow: "0 0 12px hsl(var(--module-hue))",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

/** SIMULADO — HUD scan */
const SimuladoScene: React.FC<{ size: number }> = ({ size }) => (
  <>
    <CoreHalo />
    {/* Cross-hair */}
    <div
      aria-hidden
      className="absolute rounded-full border-2"
      style={{
        inset: "10%",
        borderColor: "hsl(var(--module-hue) / 0.55)",
        animation: "cinematic-energy-ring 2.4s ease-in-out infinite",
      }}
    />
    <div
      aria-hidden
      className="absolute rounded-full border"
      style={{
        inset: "30%",
        borderColor: "hsl(var(--module-hue) / 0.7)",
      }}
    />
    {/* Cross lines */}
    <div
      aria-hidden
      className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
      style={{
        background:
          "linear-gradient(to right, transparent, hsl(var(--module-hue) / 0.6), transparent)",
      }}
    />
    <div
      aria-hidden
      className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
      style={{
        background:
          "linear-gradient(to bottom, transparent, hsl(var(--module-hue) / 0.6), transparent)",
      }}
    />
    {/* Scan sweep */}
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden rounded-full"
    >
      <div
        className="absolute left-0 right-0 h-1/2 origin-bottom"
        style={{
          top: 0,
          background:
            "linear-gradient(to bottom, hsl(var(--module-hue) / 0.25), transparent)",
          animation: "simulado-hud-sweep 2s linear infinite",
        }}
      />
    </div>
  </>
);

/** FLASHCARD — memory cards flutuando */
const FlashcardScene: React.FC<{ size: number }> = ({ size }) => {
  const cards = [
    { rotate: -12, delay: 0, offset: -size * 0.18 },
    { rotate: 0, delay: 0.3, offset: 0 },
    { rotate: 12, delay: 0.6, offset: size * 0.18 },
  ];
  return (
    <>
      <CoreHalo />
      {cards.map((c, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute rounded-lg border backdrop-blur-sm"
          style={{
            width: size * 0.32,
            height: size * 0.46,
            background:
              "linear-gradient(135deg, hsl(var(--module-hue) / 0.25), hsl(var(--module-hue) / 0.08))",
            borderColor: "hsl(var(--module-hue) / 0.4)",
            transform: `translateX(${c.offset}px) rotate(${c.rotate}deg)`,
            boxShadow: "0 8px 24px hsl(var(--module-hue) / 0.35)",
            animation: `flashcard-float 3.2s ease-in-out ${c.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
};

/** PLANNER — constelação estratégica */
const PlannerScene: React.FC<{ size: number }> = ({ size }) => {
  const nodes = [
    { x: 50, y: 18 },
    { x: 18, y: 55 },
    { x: 82, y: 55 },
    { x: 35, y: 85 },
    { x: 65, y: 85 },
  ];
  return (
    <>
      <CoreHalo />
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
      >
        {nodes.map((a, i) =>
          nodes.slice(i + 1).map((b, j) => (
            <line
              key={`${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="hsl(var(--module-hue) / 0.25)"
              strokeWidth="0.4"
              style={{
                animation: `planner-line-pulse 3s ease-in-out ${(i + j) * 0.3}s infinite`,
              }}
            />
          )),
        )}
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r="2.4"
            fill="hsl(var(--module-hue))"
            style={{
              filter: "drop-shadow(0 0 6px hsl(var(--module-hue)))",
              animation: `cinematic-star-twinkle 2.8s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </svg>
    </>
  );
};

/** ANALYTICS — órbitas de dados */
const AnalyticsScene: React.FC<{ size: number }> = ({ size }) => {
  const rings = [0, 1, 2];
  return (
    <>
      <CoreHalo />
      {rings.map((i) => {
        const ringSize = size * (0.45 + i * 0.22);
        return (
          <div
            key={i}
            aria-hidden
            className="absolute rounded-full border"
            style={{
              width: ringSize,
              height: ringSize,
              borderColor: `hsl(var(--module-hue) / ${0.35 - i * 0.08})`,
              borderStyle: i === 1 ? "dashed" : "solid",
              animation: `tutor-orbit ${5 + i * 2}s ${i % 2 ? "reverse" : "normal"} linear infinite`,
            }}
          >
            <span
              className="absolute left-1/2 rounded-full"
              style={{
                top: -3,
                width: 6,
                height: 6,
                background: "hsl(var(--module-hue))",
                boxShadow: "0 0 10px hsl(var(--module-hue))",
                transform: "translateX(-50%)",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

/** ENAFLIX — spotlight cinematográfico */
const EnaflixScene: React.FC<{ size: number }> = ({ size }) => (
  <>
    <CoreHalo />
    {/* Spotlight cone */}
    <div
      aria-hidden
      className="absolute"
      style={{
        top: "10%",
        left: "50%",
        width: size * 0.04,
        height: size * 0.04,
        background: "hsl(var(--module-hue))",
        borderRadius: "50%",
        boxShadow: "0 0 24px hsl(var(--module-hue))",
        transform: "translateX(-50%)",
      }}
    />
    <div
      aria-hidden
      className="absolute origin-top"
      style={{
        top: "10%",
        left: "50%",
        width: size * 0.7,
        height: size * 0.85,
        background:
          "linear-gradient(to bottom, hsl(var(--module-hue) / 0.4), transparent 80%)",
        clipPath: "polygon(45% 0, 55% 0, 100% 100%, 0 100%)",
        transform: "translateX(-50%)",
        animation: "enaflix-spotlight-sweep 4s ease-in-out infinite",
        filter: "blur(4px)",
      }}
    />
    {/* Frames laterais */}
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        aria-hidden
        className="absolute rounded border"
        style={{
          width: size * 0.16,
          height: size * 0.22,
          bottom: "12%",
          left: `${15 + i * 30}%`,
          borderColor: "hsl(var(--module-hue) / 0.5)",
          background: "hsl(var(--module-hue) / 0.1)",
          animation: `flashcard-float 3.6s ease-in-out ${i * 0.3}s infinite`,
        }}
      />
    ))}
  </>
);

/** PROFESSOR — mentorship grid */
const ProfessorScene: React.FC<{ size: number }> = ({ size }) => {
  const avatars = [
    { x: 20, y: 28 },
    { x: 80, y: 28 },
    { x: 50, y: 75 },
  ];
  return (
    <>
      <CoreHalo />
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
      >
        {avatars.map((a, i) =>
          avatars.slice(i + 1).map((b, j) => (
            <line
              key={`${i}-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="hsl(var(--module-hue) / 0.4)"
              strokeWidth="0.6"
              strokeDasharray="2 2"
              style={{
                animation: `planner-line-pulse 2.8s ease-in-out ${(i + j) * 0.4}s infinite`,
              }}
            />
          )),
        )}
        {avatars.map((a, i) => (
          <g key={i}>
            <circle
              cx={a.x}
              cy={a.y}
              r="6"
              fill="hsl(var(--module-hue) / 0.2)"
              stroke="hsl(var(--module-hue))"
              strokeWidth="0.8"
              style={{
                filter: "drop-shadow(0 0 8px hsl(var(--module-hue) / 0.6))",
                animation: `cinematic-pulse-core 2.4s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
            <circle cx={a.x} cy={a.y} r="2" fill="hsl(var(--module-hue))" />
          </g>
        ))}
      </svg>
    </>
  );
};

/** ADMIN — operations center radar */
const AdminScene: React.FC<{ size: number }> = ({ size }) => (
  <>
    <CoreHalo />
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        aria-hidden
        className="absolute rounded-full border"
        style={{
          inset: `${10 + i * 15}%`,
          borderColor: `hsl(var(--module-hue) / ${0.4 - i * 0.1})`,
        }}
      />
    ))}
    {/* Radar sweep */}
    <div
      aria-hidden
      className="absolute inset-[10%] overflow-hidden rounded-full"
    >
      <div
        className="absolute inset-0 origin-center"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, hsl(var(--module-hue) / 0.4) 30deg, transparent 60deg)",
          animation: "tutor-orbit 3s linear infinite",
        }}
      />
    </div>
  </>
);

/** RANKING — trophy glints */
const RankingScene: React.FC<{ size: number }> = ({ size }) => {
  const glints = Array.from({ length: 8 }, (_, i) => ({
    angle: (i * 45) % 360,
    delay: (i * 0.2) % 2,
  }));
  return (
    <>
      <CoreHalo />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: "32%",
          background:
            "radial-gradient(circle, hsl(var(--module-hue)) 0%, hsl(var(--module-hue) / 0.3) 70%)",
          boxShadow: "0 0 40px hsl(var(--module-hue) / 0.7)",
          animation: "cinematic-pulse-core 2s ease-in-out infinite",
        }}
      />
      {glints.map((g, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 4,
            height: 4,
            background: "hsl(var(--module-hue))",
            boxShadow: "0 0 8px hsl(var(--module-hue))",
            top: "50%",
            left: "50%",
            transform: `rotate(${g.angle}deg) translateY(-${size * 0.42}px)`,
            animation: `cinematic-star-twinkle 2s ease-in-out ${g.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
};

/** DASHBOARD — cockpit breathing */
const DashboardScene: React.FC<{ size: number }> = ({ size }) => (
  <>
    <CoreHalo />
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        aria-hidden
        className="absolute rounded-full border"
        style={{
          inset: `${10 + i * 12}%`,
          borderColor: `hsl(var(--module-hue) / ${0.45 - i * 0.1})`,
          animation: `cinematic-energy-ring 3.2s ease-in-out ${i * 0.4}s infinite`,
        }}
      />
    ))}
    <div
      aria-hidden
      className="absolute rounded-full"
      style={{
        inset: "38%",
        background:
          "radial-gradient(circle, hsl(var(--module-hue)) 0%, transparent 70%)",
        boxShadow: "0 0 30px hsl(var(--module-hue) / 0.7)",
        animation: "cinematic-pulse-core 2.2s ease-in-out infinite",
      }}
    />
  </>
);
