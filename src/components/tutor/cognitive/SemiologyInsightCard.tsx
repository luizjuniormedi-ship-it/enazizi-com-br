import { useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Hand, Eye, Sparkles, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";


import type {
  SemiologyInsightBlock,
  SemiologyManeuver,
} from "@/types/tutor";
import { CognitiveEmpty, safeArray } from "./_validation";

export type { SemiologyInsightBlock, SemiologyManeuver };

interface Props {
  block: SemiologyInsightBlock;
}

/**
 * SemiologyInsightCard — Cognitive UI
 * Cards visuais para manobras semiológicas (Murphy, Blumberg, etc).
 */
export function SemiologyInsightCard({ block }: Props) {
  const title = block?.payload?.title;
  const region = block?.payload?.region;
  const rawManeuvers = safeArray<SemiologyManeuver>(block?.payload?.maneuvers);
  const maneuvers = useMemo(
    () => rawManeuvers.filter((m) => m && typeof m.name === "string" && m.name.trim() !== ""),
    [rawManeuvers],
  );

  if (maneuvers.length === 0) {
    return <CognitiveEmpty title="Semiologia" message="Sem manobras para exibir." />;
  }
  useEffect(() => {
    console.log("[SemiologyInsightCard] Rendering with", maneuvers.length, "maneuvers");
  }, [maneuvers.length]);

  return (

    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-start gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title || "Semiologia"}</h4>
          {region && <p className="text-xs text-muted-foreground">Região: {region}</p>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {maneuvers.map((m, i) => (
          <motion.div
            key={`${m.name}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-background/60 to-primary/5 p-3",
              "transition-all hover:border-primary/30 hover:shadow-soft",
            )}
          >
            {/* Spotlight */}
            <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />

            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
                <Hand className="h-3.5 w-3.5" />
              </div>
              <div className="text-sm font-semibold text-foreground">{m.name}</div>
            </div>

            {m.technique && (
              <Row label="Técnica" icon={<Hand className="h-3 w-3" />}>
                {m.technique}
              </Row>
            )}
            {m.finding && (
              <Row label="Achado" icon={<Eye className="h-3 w-3" />} tone="warn">
                {m.finding}
              </Row>
            )}
            {m.interpretation && (
              <Row label="Interpretação" icon={<Sparkles className="h-3 w-3" />} tone="primary">
                {m.interpretation}
              </Row>
            )}
            {m.pathophysiology && (
              <Row label="Fisiopatologia" icon={<Stethoscope className="h-3 w-3" />}>
                {m.pathophysiology}
              </Row>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  children,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "primary" | "warn";
}) {
  const toneCls =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "primary"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <div className="mt-2">
      <div className={cn("mb-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide", toneCls)}>
        {icon}
        {label}
      </div>
      <p className="text-xs leading-snug text-foreground">{children}</p>
    </div>
  );
}
