import { useEffect, useMemo } from "react";
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
 * TutorBlockRenderer — Sprint 4 + Sprint 6 + Fase 3 (Zod)
 *
 * Renderiza uma lista de TutorBlocks em sequência, agora com validação Zod
 * dos blocos cognitivos (clinical_flow, differential_diagnosis,
 * pharmacology_compare, semiology_insight). Blocos parcialmente quebrados
 * são sanitizados; blocos irrecuperáveis caem em CognitiveEmpty (sem
 * derrubar o restante da resposta).
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

  // ── Fase 3: validação Zod + sanitização ──────────────────────────────────
  const { safeBlocks, rejected } = useMemo(() => {
    const v = validateTutorBlocks(blocks ?? []);
    return { safeBlocks: v.blocks, rejected: v.rejected };
  }, [blocks]);

  // Telemetria: log silencioso de blocos rejeitados (apenas dev/console).
  useEffect(() => {
    if (rejected.length > 0 && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeBlocks, conversationId, topic, subtopic, sync.writebackEnabled]);

  if (!safeBlocks || safeBlocks.length === 0) {
    // Se TODOS os blocos foram rejeitados, mostra um único fallback
    // discreto em vez de quebrar a resposta inteira.
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
    <div className="space-y-3">
      <TutorBlockTimeline blockTypes={safeBlocks.map((b) => b.type)} />
      {safeBlocks.map((block, i) => {
        switch (block.type) {
          case "summary":
            return <SummaryBlock key={i} block={block} />;
          case "deep_dive":
            return <DeepDiveBlock key={i} block={block} />;
          case "clinical_flow":
            return <ClinicalFlowRenderer key={i} block={block} />;
          case "differential_diagnosis":
            return <DifferentialDiagnosisBoard key={i} block={block} />;
          case "pharmacology_compare":
            return <PharmacologyCompareCard key={i} block={block} />;
          case "semiology_insight":
            return <SemiologyInsightCard key={i} block={block} />;
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
