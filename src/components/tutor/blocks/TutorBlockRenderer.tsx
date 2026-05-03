import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [visibleCount, setVisibleCount] = useState(0);

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

  // Efeito de Streaming Cognitivo: revela blocos progressivamente
  useEffect(() => {
    if (safeBlocks.length > 0) {
      setVisibleCount(0);
      const timers = safeBlocks.map((_, idx) => 
        setTimeout(() => {
          setVisibleCount(prev => prev + 1);
        }, idx * 600) // 600ms entre cada bloco pedagógico
      );
      return () => timers.forEach(t => clearTimeout(t));
    }
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
    <div className="space-y-4">
      <TutorBlockTimeline blockTypes={safeBlocks.map((b) => b.type)} />
      
      <div className="space-y-4">
        <AnimatePresence>
          {safeBlocks.map((block, i) => {
            if (i >= visibleCount) return null;

            return (
              <motion.div
                key={`${block.type}-${i}`}
                initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn(
                  "relative",
                  i === visibleCount - 1 && i < safeBlocks.length - 1 && "after:absolute after:inset-x-0 after:-bottom-4 after:h-4 after:bg-gradient-to-b after:from-primary/5 after:to-transparent"
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
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
