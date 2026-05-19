import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  Stethoscope,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TutorBlockType } from "@/types/tutor";

type Step = "ensinar" | "raciocinar" | "aplicar" | "testar" | "corrigir" | "reforcar";

const STEP_META: Record<Step, { label: string; icon: React.ReactNode }> = {
  ensinar: { label: "Ensinar", icon: <BookOpen className="h-3 w-3" /> },
  raciocinar: { label: "Raciocinar", icon: <Brain className="h-3 w-3" /> },
  aplicar: { label: "Aplicar", icon: <Stethoscope className="h-3 w-3" /> },
  testar: { label: "Testar", icon: <HelpCircle className="h-3 w-3" /> },
  corrigir: { label: "Corrigir", icon: <CheckCircle2 className="h-3 w-3" /> },
  reforcar: { label: "Reforçar", icon: <RefreshCw className="h-3 w-3" /> },
};

const ORDER: Step[] = ["ensinar", "raciocinar", "aplicar", "testar", "corrigir", "reforcar"];

/** Mapeia tipos de bloco do tutor para o estágio cognitivo correspondente. */
function blockToStep(type: TutorBlockType | string): Step | null {
  switch (type) {
    case "summary":
    case "lay_explanation":
      return "ensinar";
    case "deep_dive":
      return "raciocinar";
    case "comparison_table":
    case "clinical_flow":
    case "pharmacology_compare":
    case "semiology_insight":
    case "differential_diagnosis":
      return "aplicar";
    case "mini_quiz":
      return "testar";
    case "mnemonic_reinforce":
      return "reforcar";
    case "next_steps":
    case "reference":
      return "corrigir";
    default:
      return null;
  }
}

interface Props {
  blockTypes: Array<TutorBlockType | string>;
  className?: string;
  activeIdx?: number;
}

/**
 * TutorBlockTimeline — Cognitive UI
 * Mostra a progressão pedagógica (Ensinar → Raciocinar → Aplicar → Testar → Corrigir → Reforçar)
 * destacando os estágios já cobertos pelos blocos atuais da resposta.
 */
export function TutorBlockTimeline({ blockTypes, className }: Props) {
  const reached = new Set<Step>();
  blockTypes.forEach((t) => {
    const s = blockToStep(t);
    if (s) reached.add(s);
  });

  if (reached.size === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-background/40 p-2.5 backdrop-blur-sm",
        className,
      )}
      aria-label="Progressão cognitiva da resposta"
    >
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Progressão cognitiva
      </div>
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence>

        {ORDER.map((step, idx) => {
          const active = reached.has(step);
          const meta = STEP_META[step];
          return (
            <div key={step} className="flex shrink-0 items-center gap-1">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-all",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/30 text-muted-foreground/60",
                )}
              >
                {meta.icon}
                <span className="font-medium">{meta.label}</span>
              </motion.div>
              {idx < ORDER.length - 1 && (
                <div
                  className={cn(
                    "h-px w-2 sm:w-3",
                    active && reached.has(ORDER[idx + 1]) ? "bg-primary/40" : "bg-border/40",
                  )}
                />
              )}
            </div>
          );
        })}
        </AnimatePresence>
      </div>
    </div>
  );
}
