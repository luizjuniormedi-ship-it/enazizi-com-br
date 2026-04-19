import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  questionCount: string;
  timeLimit: string;
  onQuestionCountChange: (v: string) => void;
  onTimeLimitChange: (v: string) => void;
}

/**
 * Replica os Selects de "Quantidade (IA)" + "Tempo limite" no modo manual,
 * mantendo a UI original (Quantidade desabilitada, Tempo editável).
 */
const SimuladoManualQuantityFields = memo(function SimuladoManualQuantityFields({
  questionCount, timeLimit, onQuestionCountChange, onTimeLimitChange,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label className="text-xs">Quantidade (IA)</Label>
        <Select value={questionCount} onValueChange={onQuestionCountChange} disabled>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[5, 10, 15, 20, 30, 40, 50, 60, 80, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} questões</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Tempo limite</Label>
        <Select value={timeLimit} onValueChange={onTimeLimitChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[30, 60, 90, 120, 180].map((m) => (
              <SelectItem key={m} value={String(m)}>{m} minutos</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

export default SimuladoManualQuantityFields;
