import { motion } from "framer-motion";
import { Brain, Target, Timer, GraduationCap, Sparkles, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface MissionStage {
  id: string;
  label: string;
  /** "done" | "active" | "todo" */
  status: "done" | "active" | "todo";
}

interface Props {
  missionTitle: string;
  missionSubtitle?: string;
  stages: MissionStage[];
  /** 0-100 */
  progress: number;
  estimatedMinutes?: number;
  feynmanActive?: boolean;
  recallActive?: boolean;
  difficulty?: "fácil" | "médio" | "difícil";
}

/**
 * Hero pedagógico ENAZIZI — restaura sensação de "missão guiada".
 * Mostra missão atual, etapa, progresso, tempo restante e modos ativos
 * (Feynman / Active Recall) por cima do chat cinematográfico.
 */
export function PedagogicalMissionHero({
  missionTitle,
  missionSubtitle,
  stages,
  progress,
  estimatedMinutes,
  feynmanActive = true,
  recallActive = true,
  difficulty = "médio",
}: Props) {
  const activeStage = stages.find((s) => s.status === "active") ?? stages[stages.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative mx-3 sm:mx-6 mt-3 mb-2 rounded-3xl border border-white/10 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(99,102,241,0.4)] overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-4 sm:p-5 space-y-4">
        {/* Top row — Mission + modes */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 p-2 rounded-2xl bg-primary/20 border border-primary/30">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.35em] text-primary/80">
                  🎯 Missão Atual
                </span>
                <span className="text-[9px] font-bold uppercase text-white/40">
                  · {difficulty}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug truncate">
                {missionTitle}
              </h2>
              {missionSubtitle && (
                <p className="text-xs text-white/50 font-medium truncate">{missionSubtitle}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {feynmanActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                <Brain className="h-3 w-3" /> Feynman
              </span>
            )}
            {recallActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                <GraduationCap className="h-3 w-3" /> Active Recall
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/70">
              <Sparkles className="h-3 w-3 text-primary" /> ENAZIZI
            </span>
          </div>
        </div>

        {/* Progress + stage info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/60">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-primary" />
              Etapa atual: <span className="text-white">{activeStage?.label ?? "—"}</span>
            </span>
            <span className="flex items-center gap-3">
              {typeof estimatedMinutes === "number" && (
                <span className="flex items-center gap-1 text-white/50">
                  <Timer className="h-3 w-3" /> {estimatedMinutes} min
                </span>
              )}
              <span className="text-primary">{Math.round(progress)}%</span>
            </span>
          </div>
          <Progress value={progress} className="h-1.5 bg-white/5" />
        </div>

        {/* Roadmap cognitivo */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {stages.map((s, i) => {
            const isDone = s.status === "done";
            const isActive = s.status === "active";
            return (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.05 : 1,
                  }}
                  className={cn(
                    "relative px-2.5 py-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                    isDone &&
                      "bg-emerald-500/15 border-emerald-400/30 text-emerald-200",
                    isActive &&
                      "bg-primary/20 border-primary/50 text-white shadow-[0_0_18px_rgba(99,102,241,0.5)]",
                    !isDone && !isActive && "bg-white/5 border-white/10 text-white/40"
                  )}
                >
                  <span className="mr-1">{isDone ? "✓" : isActive ? "●" : "○"}</span>
                  {s.label}
                </motion.div>
                {i < stages.length - 1 && (
                  <div
                    className={cn(
                      "h-px w-3 sm:w-5 transition-colors",
                      isDone ? "bg-emerald-400/50" : "bg-white/10"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Mapa canônico das etapas pedagógicas ENAZIZI.
 * A ordem reflete a sequência cognitiva obrigatória:
 * Introdução → Leigo → Técnico → Clínico → Recall → Questões → Resumo.
 */
export const PEDAGOGICAL_STAGES: { id: string; label: string; blockTypes: string[] }[] = [
  { id: "intro", label: "Introdução", blockTypes: ["lay_explanation"] },
  { id: "leigo", label: "Leigo", blockTypes: ["lay_explanation", "summary"] },
  { id: "tecnico", label: "Técnico", blockTypes: ["deep_dive", "comparison_table"] },
  {
    id: "clinico",
    label: "Clínico",
    blockTypes: [
      "clinical_flow",
      "differential_diagnosis",
      "pharmacology_compare",
      "semiology_insight",
    ],
  },
  { id: "recall", label: "Recall", blockTypes: ["mini_quiz", "mnemonic_reinforce"] },
  { id: "questoes", label: "Questões", blockTypes: ["mini_quiz"] },
  { id: "resumo", label: "Resumo", blockTypes: ["summary", "next_steps", "reference"] },
];

/**
 * Deriva o estado das etapas a partir dos tipos de bloco já renderizados.
 */
export function deriveStagesFromBlockTypes(seenTypes: Set<string>): MissionStage[] {
  let activeAssigned = false;
  const stages = PEDAGOGICAL_STAGES.map((stage) => {
    const done = stage.blockTypes.some((t) => seenTypes.has(t));
    return { id: stage.id, label: stage.label, done };
  });

  return stages.map((s, i, arr) => {
    if (s.done) return { id: s.id, label: s.label, status: "done" as const };
    if (!activeAssigned) {
      activeAssigned = true;
      return { id: s.id, label: s.label, status: "active" as const };
    }
    return { id: s.id, label: s.label, status: "todo" as const };
  });
}
