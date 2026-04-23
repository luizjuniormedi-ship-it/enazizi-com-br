import * as React from "react";
import { cn } from "@/lib/utils";
import { ModuleScene } from "./ModuleScene";
import { CinematicSkeleton } from "./CinematicSkeleton";
import { useModuleAtmosphere } from "./useModuleAtmosphere";
import type { CinematicModule } from "./CinematicCard";

/**
 * Hierarquia de loaders cinematográficos.
 *
 *  1. ModulePageLoader  → fallback de página inteira (rota carregando)
 *  2. ModuleLoader      → suspense interno de seção (cena central + esqueleto leve)
 *  3. WidgetLoader      → cards/painéis individuais
 *  4. DataLoader        → tabelas/listas (linhas pulsando)
 *  5. AILoader          → IA pensando (cena neural compacta + texto contextual)
 *
 * IMPORTANTE: nenhum desses componentes renderiza `AmbientAtmosphere` interna.
 * O `AmbientPersistenceLayer` global cobre o background, garantindo
 * **continuidade emocional** entre rotas — sem reset visual.
 */

interface BaseLoaderProps {
  /** Override manual; se omitido, detecta pela rota. */
  module?: CinematicModule;
  className?: string;
}

/* ============================================================
 * 1. ModulePageLoader — fallback de rota
 * ============================================================ */
interface ModulePageLoaderProps extends BaseLoaderProps {
  hint?: string | string[];
  /** Variante de layout. */
  variant?: "default" | "minimal" | "session";
}

export const ModulePageLoader: React.FC<ModulePageLoaderProps> = ({
  module,
  hint,
  variant = "default",
  className,
}) => {
  const detected = useModuleAtmosphere();
  const m = module ?? detected;

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "relative flex min-h-[40vh] flex-col items-center justify-center gap-4 animate-fade-in",
          className,
        )}
      >
        <ModuleScene module={m} size={96} hint={hint} />
      </div>
    );
  }

  if (variant === "session") {
    return (
      <div
        className={cn(
          "relative p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in",
          className,
        )}
      >
        <div className="flex min-h-[280px] items-center justify-center">
          <ModuleScene module={m} size={140} hint={hint} />
        </div>
        <CinematicSkeleton module={m} shape="card" className="h-40" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CinematicSkeleton module={m} shape="card" className="h-20" delay={0} />
          <CinematicSkeleton module={m} shape="card" className="h-20" delay={120} />
          <CinematicSkeleton module={m} shape="card" className="h-20" delay={240} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative p-3 sm:p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in",
        className,
      )}
    >
      {/* Cena central — alma do módulo */}
      <div className="flex min-h-[260px] items-center justify-center">
        <ModuleScene module={m} size={128} hint={hint} />
      </div>

      {/* Esqueleto suplementar — sugestão de layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CinematicSkeleton
            key={i}
            module={m}
            shape="card"
            className="h-24"
            delay={i * 100}
          />
        ))}
      </div>

      <CinematicSkeleton
        module={m}
        shape="card"
        className="h-48"
        intensity="strong"
        delay={400}
      />
    </div>
  );
};

/* ============================================================
 * 2. ModuleLoader — seção interna (suspense de bloco)
 * ============================================================ */
interface ModuleLoaderProps extends BaseLoaderProps {
  hint?: string | string[];
  /** Altura mínima da área. */
  minHeight?: number | string;
}

export const ModuleLoader: React.FC<ModuleLoaderProps> = ({
  module,
  hint,
  minHeight = 200,
  className,
}) => {
  const detected = useModuleAtmosphere();
  const m = module ?? detected;
  return (
    <div
      className={cn(
        "relative flex items-center justify-center animate-fade-in",
        className,
      )}
      style={{ minHeight }}
    >
      <ModuleScene module={m} size={84} hint={hint} />
    </div>
  );
};

/* ============================================================
 * 3. WidgetLoader — card/painel individual
 * ============================================================ */
interface WidgetLoaderProps extends BaseLoaderProps {
  /** Altura do widget. */
  height?: number | string;
  /** Mostrar barra de título no topo. */
  showHeader?: boolean;
}

export const WidgetLoader: React.FC<WidgetLoaderProps> = ({
  module,
  height = 120,
  showHeader = true,
  className,
}) => {
  const detected = useModuleAtmosphere();
  const m = module ?? detected;
  return (
    <div
      className={cn("space-y-3 animate-fade-in", className)}
      style={{ minHeight: height }}
    >
      {showHeader && (
        <CinematicSkeleton module={m} shape="pill" className="h-4 w-1/3" />
      )}
      <CinematicSkeleton
        module={m}
        shape="card"
        style={{ height: typeof height === "number" ? height - 24 : height }}
      />
    </div>
  );
};

/* ============================================================
 * 4. DataLoader — listas/tabelas
 * ============================================================ */
interface DataLoaderProps extends BaseLoaderProps {
  rows?: number;
  rowHeight?: number;
}

export const DataLoader: React.FC<DataLoaderProps> = ({
  module,
  rows = 5,
  rowHeight = 48,
  className,
}) => {
  const detected = useModuleAtmosphere();
  const m = module ?? detected;
  return (
    <div className={cn("space-y-2 animate-fade-in", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <CinematicSkeleton
          key={i}
          module={m}
          shape="card"
          style={{ height: rowHeight }}
          delay={i * 60}
          intensity="soft"
        />
      ))}
    </div>
  );
};

/* ============================================================
 * 5. AILoader — IA pensando (compact + cena neural)
 * ============================================================ */
interface AILoaderProps extends BaseLoaderProps {
  hint?: string | string[];
  /** Compacto inline (chat) ou em bloco. */
  inline?: boolean;
}

const defaultAIHints = [
  "Pensando…",
  "Conectando conceitos…",
  "Estruturando resposta…",
  "Refinando raciocínio…",
];

export const AILoader: React.FC<AILoaderProps> = ({
  module = "tutor",
  hint = defaultAIHints,
  inline = false,
  className,
}) => {
  const hints = Array.isArray(hint) ? hint : [hint];
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (hints.length <= 1) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % hints.length), 2000);
    return () => window.clearInterval(id);
  }, [hints.length]);

  if (inline) {
    return (
      <div
        className={cn("flex items-center gap-2 animate-fade-in", className)}
        style={{ ["--module-hue" as never]: `var(--hue-${module})` }}
      >
        <span className="relative inline-flex h-2 w-2">
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "hsl(var(--module-hue))",
              boxShadow: "0 0 8px hsl(var(--module-hue))",
              animation: "cinematic-pulse-core 1.4s ease-in-out infinite",
            }}
          />
        </span>
        <span
          key={idx}
          className="animate-fade-in text-xs text-muted-foreground"
        >
          {hints[idx]}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-6 animate-fade-in",
        className,
      )}
    >
      <ModuleScene module={module} size={72} hint={hints} />
    </div>
  );
};
