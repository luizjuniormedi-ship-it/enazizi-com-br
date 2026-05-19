import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SummaryBlock } from "./SummaryBlock";
import { DeepDiveBlock } from "./DeepDiveBlock";
import { MiniQuizBlock } from "./MiniQuizBlock";
import { NextStepsBlock } from "./NextStepsBlock";
import {
  ClinicalFlowRenderer,
  DifferentialDiagnosisBoard,
  PharmacologyCompareCard,
  SemiologyInsightCard,
  TutorBlockTimeline,
} from "@/components/tutor/cognitive";
import { CognitiveEmpty } from "@/components/tutor/cognitive/_validation";
import { useTutorAdaptiveSync } from "@/components/agents/hooks/useTutorAdaptiveSync";
import { validateTutorBlocks } from "@/lib/tutor/blockValidation";
import type { TutorAction, TutorBlock } from "@/types/tutor";
import { cn } from "@/lib/utils";

interface Props {
  blocks: TutorBlock[];
  /** Contexto adaptativo opcional — usado para writeback (Sprint 6). */
  conversationId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  onQuizAnswered?: (params: { correct: boolean; selectedIndex: number; block: TutorBlock }) => void;
  onActionClick?: (action: TutorAction) => void;
}

const BLOCK_PRIORITY: Record<string, number> = {
  summary: 1, // Leigo
  deep_dive: 2, // Técnico
  clinical_flow: 3, // Clínico
  differential_diagnosis: 3, // Clínico
  pharmacology_compare: 3, // Clínico
  semiology_insight: 3, // Clínico
  mini_quiz: 4, // Recall
  next_steps: 5,
};

/**
 * TutorBlockRenderer — Sprint 4 + Sprint 6 + Fase 3 (Zod)
 * Evolução: Streaming Cognitivo (Fase 7)
 * 
 * Agora ordena os blocos pedagogicamente: 
 * Leigo -> Técnico -> Clínico -> Recall.
 */
export function TutorBlockRenderer({
  blocks,
  conversationId,
  topic,
  subtopic,
  onQuizAnswered,
  onActionClick,
}: Props) {
  const sync = useTutorAdaptiveSync();
  const [unlockedCount, setUnlockedCount] = useState(1);

  // ── Fase 3: validação Zod + sanitização ──────────────────────────────────
  const { safeBlocks, rejected } = useMemo(() => {
    const v = validateTutorBlocks(blocks ?? []);
    
    // Ordenação Pedagógica (Fase 7)
    const sorted = [...v.blocks].sort((a, b) => {
      const pA = BLOCK_PRIORITY[a.type] || 99;
      const pB = BLOCK_PRIORITY[b.type] || 99;
      return pA - pB;
    });

    return { safeBlocks: sorted, rejected: v.rejected };
  }, [blocks]);

  // Reset unlockedCount when blocks change (new message)
  useEffect(() => {
    setUnlockedCount(1);
  }, [safeBlocks.length]);

  // Telemetria: log silencioso de blocos rejeitados (apenas dev/console).
  useEffect(() => {
    if (rejected.length > 0 && import.meta.env.DEV) {
      console.warn("[TutorBlockRenderer] blocos rejeitados:", rejected);
    }
  }, [rejected]);

  // block_rendered (1x por tipo, com dedupe interno do hook)
  useEffect(() => {
    if (!safeBlocks || safeBlocks.length === 0 || !sync.writebackEnabled) return;
    const seen = new Set<string>();
    safeBlocks.forEach((b) => {
      if (seen.has(b.type)) return;
      seen.add(b.type);
      sync.logBlockRendered({
        block_type: b.type,
        conversationId,
        topic,
        subtopic,
      });
    });
  }, [safeBlocks, conversationId, topic, subtopic, sync.writebackEnabled]);

  if (!safeBlocks || safeBlocks.length === 0) {
    if (rejected.length > 0) {
      return (
        <CognitiveEmpty
          title="Conteúdo cognitivo indisponível"
          message="A IA enviou blocos com formato inválido. Tente reformular a pergunta."
        />
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <TutorBlockTimeline 
        blockTypes={safeBlocks.map((b) => b.type)} 
        activeIdx={unlockedCount - 1}
      />
      
      <div className="space-y-8">
        <AnimatePresence>
          {safeBlocks.map((block, i) => {
            if (i >= unlockedCount) return null;

            return (
              <motion.div
                key={`${block.type}-${i}`}
                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "relative p-1 rounded-3xl transition-all duration-500",
                  i === unlockedCount - 1 && "ring-1 ring-primary/20 bg-primary/5 shadow-2xl shadow-primary/5"
                )}
              >
                {(() => {
                  switch (block.type) {
                    case "summary":
                      return <SummaryBlock block={block} />;
                    case "deep_dive":
                      return <DeepDiveBlock block={block} />;
                    case "clinical_flow":
                      return <ClinicalFlowRenderer block={block} />;
                    case "differential_diagnosis":
                      return <DifferentialDiagnosisBoard block={block} />;
                    case "pharmacology_compare":
                      return <PharmacologyCompareCard block={block} />;
                    case "semiology_insight":
                      return <SemiologyInsightCard block={block} />;
                    case "mini_quiz":
                      return (
                        <MiniQuizBlock
                          block={block}
                          onAnswered={(p) => {
                            sync.logQuizAnswered({
                              correct: p.correct,
                              selectedIndex: p.selectedIndex,
                              correctIndex: block.payload.correct_index,
                              stem: block.payload.stem,
                              topic: block.payload.topic ?? topic ?? null,
                              subtopic: block.payload.subtopic ?? subtopic ?? null,
                              conversationId,
                              block_type: "mini_quiz",
                            });
                            onQuizAnswered?.({ ...p, block });
                            // Auto-unlock next block on quiz answer if it's the current one
                            if (i === unlockedCount - 1 && unlockedCount < safeBlocks.length) {
                              setTimeout(() => setUnlockedCount(prev => prev + 1), 1000);
                            }
                          }}
                        />
                      );
                    case "next_steps":
                      return (
                        <NextStepsBlock
                          block={block}
                          onActionClick={(action) => {
                            sync.logNextStepClicked({
                              action_kind: action.kind,
                              action_label: action.label,
                              conversationId,
                              topic,
                              subtopic,
                            });
                            onActionClick?.(action);
                          }}
                        />
                      );
                    default:
                      return null;
                  }
                })()}

                {/* Gate Button */}
                {i === unlockedCount - 1 && unlockedCount < safeBlocks.length && block.type !== "mini_quiz" && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-8 flex justify-center"
                  >
                    <button
                      onClick={() => setUnlockedCount(prev => prev + 1)}
                      className="group relative flex items-center gap-4 px-10 py-5 rounded-[24px] bg-primary text-white font-black text-sm uppercase tracking-[0.1em] hover:scale-105 hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] transition-all active:scale-95 border border-white/20"
                    >
                      <div className="absolute inset-0 bg-white/10 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span>Dominei esta parte, avançar</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
