import { SummaryBlock } from "./SummaryBlock";
import { DeepDiveBlock } from "./DeepDiveBlock";
import { MiniQuizBlock } from "./MiniQuizBlock";
import { NextStepsBlock } from "./NextStepsBlock";
import type { TutorAction, TutorBlock } from "@/types/tutor";

interface Props {
  blocks: TutorBlock[];
  onQuizAnswered?: (params: { correct: boolean; selectedIndex: number; block: TutorBlock }) => void;
  onActionClick?: (action: TutorAction) => void;
}

/**
 * TutorBlockRenderer — Sprint 4
 *
 * Renderiza uma lista de TutorBlocks em sequência. Tipos não suportados
 * nesta sprint (comparison_table, clinical_flow, mnemonic_reinforce, reference)
 * fazem fallback para um placeholder simples — sem quebrar a UI.
 */
export function TutorBlockRenderer({ blocks, onQuizAnswered, onActionClick }: Props) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "summary":
            return <SummaryBlock key={i} block={block} />;
          case "deep_dive":
            return <DeepDiveBlock key={i} block={block} />;
          case "mini_quiz":
            return (
              <MiniQuizBlock
                key={i}
                block={block}
                onAnswered={(p) => onQuizAnswered?.({ ...p, block })}
              />
            );
          case "next_steps":
            return <NextStepsBlock key={i} block={block} onActionClick={onActionClick} />;
          default:
            // Fallback silencioso para tipos ainda não implementados.
            return null;
        }
      })}
    </div>
  );
}
