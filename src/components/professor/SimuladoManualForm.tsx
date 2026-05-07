import { memo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  manualStatement: string;
  manualOptions: string[];
  manualCorrect: string;
  manualTopic: string;
  onStatementChange: (v: string) => void;
  onOptionChange: (i: number, v: string) => void;
  onCorrectChange: (v: string) => void;
  onTopicChange: (v: string) => void;
  onAddManualQuestion: () => void;
}

/**
 * Form de criação manual de questão. Isolado para que digitação
 * não rerenderize o resto do dialog.
 */
const SimuladoManualForm = memo(function SimuladoManualForm({
  manualStatement, manualOptions, manualCorrect, manualTopic,
  onStatementChange, onOptionChange, onCorrectChange, onTopicChange, onAddManualQuestion,
}: Props) {
  return (
    <div className="space-y-4 border border-white/5 rounded-2xl p-4 bg-white/5">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Enunciado / Caso Clínico</Label>
        <Textarea
          value={manualStatement}
          onChange={(e) => onStatementChange(e.target.value)}
          placeholder="Paciente de 55 anos, hipertenso, apresenta dor precordial..."
          rows={3}
          className="bg-white/5 border-white/10 rounded-xl px-4 py-3 resize-none text-xs"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Alternativas</Label>
        {["A", "B", "C", "D", "E"].map((letter, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                manualCorrect === String(i)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border"
              }`}
            >
              {letter}
            </span>
            <Input
              value={manualOptions[i]}
              onChange={(e) => onOptionChange(i, e.target.value)}
              placeholder={`Alternativa ${letter}`}
              className="flex-1 h-9 bg-white/5 border-white/10 rounded-xl text-xs px-3"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">Gabarito</Label>
          <Select value={manualCorrect} onValueChange={onCorrectChange}>
            <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["A", "B", "C", "D", "E"].map((l, i) => (
                <SelectItem key={i} value={String(i)}>Alternativa {l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Tema</Label>
          <Input
            value={manualTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="Digite o tema (ex: Cardiologia)"
            className="h-8 text-xs"
          />
        </div>
      </div>

      <Button
        type="button"
        onClick={onAddManualQuestion}
        disabled={!manualStatement.trim() || manualOptions.filter((o) => o.trim()).length < 2}
        variant="secondary"
        className="w-full gap-1.5"
        size="sm"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar Questão
      </Button>
    </div>
  );
});

export default SimuladoManualForm;
