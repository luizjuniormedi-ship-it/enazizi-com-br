import { useEffect } from "react";
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
  type DifferentialDiagnosisBlock,
  type PharmacologyCompareBlock,
  type SemiologyInsightBlock,
} from "@/components/tutor/cognitive";
import { useTutorAdaptiveSync } from "@/components/agents/hooks/useTutorAdaptiveSync";
import type { TutorAction, TutorBlock } from "@/types/tutor";

// Tipos cognitivos extras (aceitos via narrowing — não fazem parte do union oficial)
type CognitiveExtraBlock =
  | DifferentialDiagnosisBlock
  | PharmacologyCompareBlock
  | SemiologyInsightBlock;
type AnyTutorBlock = TutorBlock | CognitiveExtraBlock;

interface Props {
  blocks: TutorBlock[];
  /** Contexto adaptativo opcional — usado para writeback (Sprint 6). */
  conversationId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  onQuizAnswered?: (params: { correct: boolean; selectedIndex: number; block: TutorBlock }) => void;
  onActionClick?: (action: TutorAction) => void;
}

/**
 * TutorBlockRenderer — Sprint 4 + Sprint 6
 *
 * Renderiza uma lista de TutorBlocks em sequência. Tipos não suportados
 * nesta sprint (comparison_table, clinical_flow, mnemonic_reinforce, reference)
 * fazem fallback silencioso.
 *
 * Sprint 6: dispara writeback adaptativo via useTutorAdaptiveSync
 * (no-op se a flag `tutor_adaptive_writeback_enabled` estiver OFF).
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

  // block_rendered (1x por tipo, com dedupe interno do hook)
  useEffect(() => {
    if (!blocks || blocks.length === 0 || !sync.writebackEnabled) return;
    const seen = new Set<string>();
    blocks.forEach((b) => {
      if (seen.has(b.type)) return;
      seen.add(b.type);
      sync.logBlockRendered({
        block_type: b.type,
        conversationId,
        topic,
        subtopic,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, conversationId, topic, subtopic, sync.writebackEnabled]);

  if (!blocks || blocks.length === 0) return null;

  const blockList = blocks as AnyTutorBlock[];

  return (
    <div className="space-y-3">
      <TutorBlockTimeline blockTypes={blockList.map((b) => b.type)} />
      {blockList.map((block, i) => {
        switch (block.type) {
          case "summary":
            return <SummaryBlock key={i} block={block} />;
          case "deep_dive":
            return <DeepDiveBlock key={i} block={block} />;
          case "clinical_flow":
            return <ClinicalFlowRenderer key={i} block={block} />;
          case "differential_diagnosis":
            return <DifferentialDiagnosisBoard key={i} block={block as DifferentialDiagnosisBlock} />;
          case "pharmacology_compare":
            return <PharmacologyCompareCard key={i} block={block as PharmacologyCompareBlock} />;
          case "semiology_insight":
            return <SemiologyInsightCard key={i} block={block as SemiologyInsightBlock} />;
          case "mini_quiz":
            return (
              <MiniQuizBlock
                key={i}
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
                key={i}
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
      })}
    </div>
  );
}
