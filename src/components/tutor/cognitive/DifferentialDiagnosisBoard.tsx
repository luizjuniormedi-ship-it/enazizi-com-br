import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, Check, ChevronDown, Crosshair, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";


import type {
  DifferentialDiagnosisBlock,
  DifferentialItem,
} from "@/types/tutor";
import { CognitiveEmpty, clamp01, dedupeBy, safeArray } from "./_validation";

export type { DifferentialDiagnosisBlock, DifferentialItem };

interface Props {
  block: DifferentialDiagnosisBlock;
}

/**
 * DifferentialDiagnosisBoard — Cognitive UI
 * Board visual ranqueado com hierarquia de cor:
 *  - verde: mais provável
 *  - vermelho: não-perder / crítica
 *  - âmbar: gravidade alta
 *  - cinza: menos provável
 */
export function DifferentialDiagnosisBoard({ block }: Props) {
  const title = block?.payload?.title;
  const chief_complaint = block?.payload?.chief_complaint;
  const rawItems = safeArray<DifferentialItem>(block?.payload?.items);

  const sorted = useMemo(() => {
    const valid = rawItems
      .filter((it) => it && typeof it.name === "string" && it.name.trim() !== "")
      .map((it) => ({ ...it, probability: clamp01(it.probability) }));
    const deduped = dedupeBy(valid, (it) => it.name);
    return [...deduped].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  }, [rawItems]);

  const [open, setOpen] = useState<string | null>(sorted[0]?.name ?? null);

  if (sorted.length === 0) {
    return <CognitiveEmpty title="Diagnóstico diferencial" message="Sem hipóteses para ranquear." />;
  }

  useEffect(() => {
    console.log("[DifferentialDiagnosisBoard] Rendering with", sorted.length, "items");
  }, [sorted.length]);

  return (

    <div className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-start gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Crosshair className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title || "Diagnóstico diferencial"}</h4>
          {chief_complaint && (
            <p className="text-xs text-muted-foreground">Queixa: {chief_complaint}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((item, idx) => {
          const tone = ddxTone(item, idx === 0);
          const isOpen = open === item.name;
          return (
            <motion.div
              key={item.name}
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: idx * 0.04 }}
              className={cn(
                "rounded-xl border transition-all",
                tone.border,
                tone.bg,
                isOpen && "shadow-soft",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.name)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tone.iconBg)}>
                  {tone.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{item.name}</span>
                    {item.doNotMiss && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        <ShieldAlert className="h-2.5 w-2.5" /> não perder
                      </span>
                    )}
                    {idx === 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        + provável
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProbBar value={item.probability ?? 0} tone={tone.bar} />
                    <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                      {Math.round((item.probability ?? 0) * 100)}%
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (item.pros?.length || item.cons?.length) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="grid gap-2 overflow-hidden border-t border-border/40 px-3 pb-3 pt-2 sm:grid-cols-2"
                  >
                    {item.pros && item.pros.length > 0 && (
                      <EvidenceList title="A favor" tone="pro" items={item.pros} />
                    )}
                    {item.cons && item.cons.length > 0 && (
                      <EvidenceList title="Contra" tone="con" items={item.cons} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ProbBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/50">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn("h-full rounded-full", tone)}
      />
    </div>
  );
}

function EvidenceList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "pro" | "con";
}) {
  const isPro = tone === "pro";
  return (
    <div>
      <div
        className={cn(
          "mb-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide",
          isPro ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        )}
      >
        {isPro ? <Check className="h-3 w-3" /> : <AlertOctagon className="h-3 w-3" />}
        {title}
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="leading-snug">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ddxTone(item: DifferentialItem, isTop: boolean) {
  if (item.doNotMiss || item.severity === "critica") {
    return {
      border: "border-destructive/30",
      bg: "bg-destructive/5",
      iconBg: "bg-destructive/15 text-destructive",
      icon: <ShieldAlert className="h-4 w-4" />,
      bar: "bg-destructive/70",
    };
  }
  if (isTop) {
    return {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/5",
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      icon: <Crosshair className="h-4 w-4" />,
      bar: "bg-emerald-500/70",
    };
  }
  if (item.severity === "alta") {
    return {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      icon: <AlertOctagon className="h-4 w-4" />,
      bar: "bg-amber-500/70",
    };
  }
  return {
    border: "border-border/60",
    bg: "bg-muted/20",
    iconBg: "bg-muted text-muted-foreground",
    icon: <Crosshair className="h-4 w-4" />,
    bar: "bg-muted-foreground/40",
  };
}
