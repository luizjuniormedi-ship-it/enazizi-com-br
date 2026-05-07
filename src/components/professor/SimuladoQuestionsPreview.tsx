import { memo, useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import SimuladoQuestionItem from "./SimuladoQuestionItem";

interface Props {
  allQs: any[];
  groupedBlocks: [string, any[]][];
  target: number;
  deficit: number;
  questionMode: "ai" | "manual";
  expandedQuestion: number | null;
  generating: boolean;
  onSetExpanded: (idx: number | null) => void;
  onRegenerateMissing: () => void;
  onRemoveGenerated: (idx: number) => void;
  onRemoveManual: (idx: number) => void;
}

/**
 * Lista/preview de questões geradas ou manuais. Itens individuais são
 * memoizados (SimuladoQuestionItem) — expandir uma questão só renderiza
 * o item afetado.
 */
const SimuladoQuestionsPreview = memo(function SimuladoQuestionsPreview({
  allQs, groupedBlocks, target, deficit, questionMode, expandedQuestion, generating,
  onSetExpanded, onRegenerateMissing, onRemoveGenerated, onRemoveManual,
}: Props) {
  const handleToggleExpand = useCallback(
    (idx: number) => onSetExpanded(expandedQuestion === idx ? null : idx),
    [expandedQuestion, onSetExpanded]
  );

  const handleRemove = useCallback(
    (idx: number) => {
      if (questionMode === "manual") onRemoveManual(idx);
      else onRemoveGenerated(idx);
      if (expandedQuestion === idx) onSetExpanded(null);
    },
    [questionMode, onRemoveManual, onRemoveGenerated, expandedQuestion, onSetExpanded]
  );

  if (allQs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">
          ✅ {allQs.length}/{target} QUESTÕES{" "}
          {questionMode === "ai" ? "GERADAS" : "CRIADAS"}
        </Label>
        {deficit > 0 && questionMode === "ai" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRegenerateMissing}
            disabled={generating}
            className="h-8 gap-2 rounded-xl border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-black uppercase tracking-widest text-[10px]"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            REGENERAR {deficit} FALTANTES
          </Button>
        )}
      </div>
      {deficit > 0 && questionMode === "ai" && (
        <p className="text-[11px] text-amber-600">
          ⚠️ {deficit} questão(ões) excluída(s). Clique em "Regenerar" para completar.
        </p>
      )}
      <div className="max-h-[400px] overflow-y-auto space-y-2">
        {groupedBlocks.map(([block, questions], blockIdx) => (
          <div key={`${block}-${blockIdx}`}>
            {groupedBlocks.length > 1 && (
              <div className="flex items-center gap-2 py-1.5 px-2 bg-primary/10 rounded-md mb-1.5">
                <span className="text-xs font-semibold text-primary">
                  📋 Bloco: {block} — {questions?.length || 0} questão(ões)
                </span>
              </div>
            )}
            {Array.isArray(questions) && questions.map((q, qIdx) => {
              const globalIdx = allQs.indexOf(q);
              return (
                <SimuladoQuestionItem
                  key={`q-${globalIdx}-${qIdx}`}
                  q={q}
                  globalIdx={globalIdx}
                  block={block}
                  isExpanded={expandedQuestion === globalIdx}
                  onToggleExpand={handleToggleExpand}
                  onRemove={handleRemove}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

export default SimuladoQuestionsPreview;
