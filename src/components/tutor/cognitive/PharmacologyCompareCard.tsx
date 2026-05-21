import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, Sparkles, ChevronDown, AlertTriangle, Ban, Activity, Clock } from "lucide-react";
import { cn } from "@/lib/utils";


import type {
  PharmacologyCompareBlock,
  DrugComparisonItem,
} from "@/types/tutor";
import { CognitiveEmpty, dedupeBy, safeArray } from "./_validation";

export type { PharmacologyCompareBlock, DrugComparisonItem };

interface Props {
  block: PharmacologyCompareBlock;
}

/**
 * PharmacologyCompareCard — Cognitive UI
 * Painel premium de comparação entre fármacos. Glass cards com expansão.
 */
export function PharmacologyCompareCard({ block }: Props) {
  const title = block?.payload?.title;
  const indication = block?.payload?.indication;
  const rawDrugs = safeArray<DrugComparisonItem>(block?.payload?.drugs);

  const drugs = useMemo(() => {
    const valid = rawDrugs.filter((d) => d && typeof d.name === "string" && d.name.trim() !== "");
    return dedupeBy(valid, (d) => d.name);
  }, [rawDrugs]);

  const [open, setOpen] = useState<string | null>(
    drugs.find((d) => d.preferred)?.name ?? drugs[0]?.name ?? null,
  );

  if (drugs.length === 0) {
    return <CognitiveEmpty title="Comparação farmacológica" message="Sem fármacos para comparar." />;
  }

  useEffect(() => {
    console.log("[PharmacologyCompareCard] Rendering with", drugs.length, "drugs");
  }, [drugs.length]);

  return (

    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/70 to-primary/5 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-start gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Pill className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{title || "Comparação farmacológica"}</h4>
          {indication && <p className="text-xs text-muted-foreground">Indicação: {indication}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        {drugs.map((drug, idx) => {
          const isOpen = open === drug.name;
          return (
            <motion.div
              key={drug.name}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: idx * 0.04 }}
              className={cn(
                "rounded-xl border bg-background/40 backdrop-blur-sm transition-all",
                drug.preferred
                  ? "border-emerald-500/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.1)]"
                  : "border-border/60",
                isOpen && "shadow-soft",
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : drug.name)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    drug.preferred
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Pill className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{drug.name}</span>
                    {drug.class && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {drug.class}
                      </span>
                    )}
                    {drug.preferred && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-2.5 w-2.5" /> escolha ideal
                      </span>
                    )}
                  </div>
                  {drug.clinical_advantage && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {drug.clinical_advantage}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden border-t border-border/40 px-3 pb-3 pt-2"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {drug.mechanism && (
                        <Field icon={<Activity className="h-3 w-3" />} label="Mecanismo" tone="primary">
                          {drug.mechanism}
                        </Field>
                      )}
                      {(drug.potency || drug.half_life) && (
                        <Field icon={<Clock className="h-3 w-3" />} label="Farmacocinética" tone="primary">
                          {[drug.potency, drug.half_life].filter(Boolean).join(" · ")}
                        </Field>
                      )}
                      {drug.adverse && drug.adverse.length > 0 && (
                        <Field icon={<AlertTriangle className="h-3 w-3" />} label="Efeitos adversos" tone="warn">
                          <BulletList items={drug.adverse} />
                        </Field>
                      )}
                      {drug.contraindications && drug.contraindications.length > 0 && (
                        <Field icon={<Ban className="h-3 w-3" />} label="Contraindicações" tone="danger">
                          <BulletList items={drug.contraindications} />
                        </Field>
                      )}
                      {drug.interactions && drug.interactions.length > 0 && (
                        <Field
                          icon={<AlertTriangle className="h-3 w-3" />}
                          label="Interações"
                          tone="warn"
                          full
                        >
                          <BulletList items={drug.interactions} />
                        </Field>
                      )}
                    </div>
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

function Field({
  icon,
  label,
  children,
  tone,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone: "primary" | "warn" | "danger";
  full?: boolean;
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary";
  return (
    <div className={cn("rounded-lg border border-border/40 bg-background/40 p-2.5", full && "sm:col-span-2")}>
      <div className={cn("mb-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide", toneCls)}>
        {icon}
        {label}
      </div>
      <div className="text-xs text-foreground">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0.5 text-muted-foreground">
      {items.map((it, i) => (
        <li key={i} className="leading-snug">
          • {it}
        </li>
      ))}
    </ul>
  );
}
