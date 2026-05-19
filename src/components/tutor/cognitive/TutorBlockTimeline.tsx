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
export function TutorBlockTimeline({ blockTypes, className, activeIdx = 99 }: Props) {
  const reached = new Set<Step>();
  blockTypes.forEach((t, i) => {
    const s = blockToStep(t);
    // Only show as reached if it's within the unlocked index
    if (s && i <= activeIdx) reached.add(s);
  });

  const currentStep = blockToStep(blockTypes[activeIdx]);

  if (blockTypes.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl shadow-2xl",
        className,
      )}
      aria-label="Progressão cognitiva da resposta"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Arquitetura Cognitiva
        </div>
        <div className="flex gap-1">
          {blockTypes.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-1 w-4 rounded-full transition-all duration-500",
                i <= activeIdx ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-white/10"
              )} 
            />
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence>
          {ORDER.map((step, idx) => {
            const isReached = reached.has(step);
            const isCurrent = currentStep === step;
            const meta = STEP_META[step];
            
            return (
              <div key={step} className="flex shrink-0 items-center gap-1">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isCurrent ? 1.05 : 1,
                    filter: isReached || isCurrent ? "blur(0px)" : "blur(1px)"
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold transition-all duration-500",
                    isReached
                      ? "border-primary/40 bg-primary/20 text-primary shadow-lg shadow-primary/10"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary animate-pulse"
                        : "border-white/5 bg-white/5 text-white/20",
                  )}
                >
                  <span className={cn("transition-transform duration-500", isCurrent && "scale-110")}>
                    {meta.icon}
                  </span>
                  <span className="tracking-tight">{meta.label}</span>
                </motion.div>
                {idx < ORDER.length - 1 && (
                  <div
                    className={cn(
                      "h-px w-2 sm:w-4 transition-all duration-700",
                      isReached ? "bg-primary/40" : "bg-white/5",
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
