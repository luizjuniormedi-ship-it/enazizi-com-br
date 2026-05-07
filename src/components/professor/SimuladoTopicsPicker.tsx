import { memo, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Props {
  selectedTopics: string[];
  newTopicInput: string;
  subtopics: Record<string, string>;
  questionMode: "ai" | "manual";
  questionCount: string;
  useDistribution: boolean;
  topicDistribution: Record<string, number>;
  onNewTopicInputChange: (v: string) => void;
  onAddTopic: () => void;
  onRemoveTopic: (topic: string) => void;
  onSubtopicChange: (topic: string, value: string) => void;
  onToggleDistribution: (v: boolean) => void;
  onUpdateTopicDistribution: (topic: string, value: number) => void;
}

/**
 * Bloco de seleção de temas + subtemas + distribuição por tema.
 * Isolado para que digitar subtema ou ajustar distribuição não
 * rerenderize alunos, questões ou dificuldade.
 */
const SimuladoTopicsPicker = memo(function SimuladoTopicsPicker({
  selectedTopics, newTopicInput, subtopics, questionMode, questionCount,
  useDistribution, topicDistribution,
  onNewTopicInputChange, onAddTopic, onRemoveTopic, onSubtopicChange,
  onToggleDistribution, onUpdateTopicDistribution,
}: Props) {
  const distributionSum = useMemo(
    () => Object.values(topicDistribution).reduce((a, b) => a + b, 0),
    [topicDistribution]
  );
  const targetCount = parseInt(questionCount);

  return (
    <div className="space-y-3">
      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50">
        Temas ({selectedTopics.length} selecionados)
      </Label>
      <div className="flex gap-2">
        <Input
          placeholder="Digite o tema (ex: Cardiologia, Pneumologia...)"
          value={newTopicInput}
          onChange={(e) => onNewTopicInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddTopic();
            }
          }}
          className="h-11 bg-white/5 border-white/10 rounded-xl px-4"
        />
        <Button 
          type="button" 
          onClick={onAddTopic} 
          disabled={!newTopicInput.trim()}
          className="h-11 px-6 rounded-xl font-black uppercase tracking-widest text-[10px]"
        >
          ADICIONAR
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selectedTopics.map((topic, idx) => (
          <Badge
            key={`${topic}-${idx}`}
            variant="secondary"
            className="gap-1 cursor-pointer"
            onClick={() => onRemoveTopic(topic)}
          >
            {topic} ✕
          </Badge>
        ))}
      </div>

      {/* Subtopics */}
      {selectedTopics.length > 0 && (
        <div className="space-y-2 bg-secondary/30 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Subtemas específicos (opcional) — ex: IAM, TEP, Pré-eclâmpsia
          </p>
          {selectedTopics.map((topic, idx) => (
            <div key={`${topic}-sub-${idx}`} className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {topic}
              </Badge>
              <Input
                value={subtopics[topic] || ""}
                onChange={(e) => onSubtopicChange(topic, e.target.value)}
                placeholder={`Subtemas de ${topic} (separados por vírgula)`}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {/* Topic distribution */}
      {selectedTopics.length > 1 && questionMode === "ai" && (
        <div className="space-y-2 bg-primary/5 rounded-lg p-3 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <Label className="text-xs font-semibold">Distribuição por tema</Label>
            </div>
            <Switch checked={useDistribution} onCheckedChange={onToggleDistribution} />
          </div>
          {useDistribution && (
            <div className="space-y-1.5">
              {selectedTopics.map((topic, idx) => (
                <div key={`${topic}-dist-${idx}`} className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 text-[10px] min-w-[100px]">
                    {topic}
                  </Badge>
                  <Input
                    type="number"
                    min={0}
                    max={targetCount}
                    value={topicDistribution[topic] || 0}
                    onChange={(e) =>
                      onUpdateTopicDistribution(topic, parseInt(e.target.value) || 0)
                    }
                    className="h-7 w-20 text-xs text-center"
                  />
                  <span className="text-[10px] text-muted-foreground">questões</span>
                </div>
              ))}
              {distributionSum !== targetCount ? (
                <p className="text-[10px] text-destructive font-medium">
                  ⚠️ Total: {distributionSum} (esperado: {targetCount})
                </p>
              ) : (
                <p className="text-[10px] text-emerald-600 font-medium">
                  ✅ Total: {distributionSum} questões
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SimuladoTopicsPicker;
