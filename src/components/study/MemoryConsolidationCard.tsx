import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, CheckCircle2, AlertTriangle } from "lucide-react";
import { useMemoryConsolidation } from "@/hooks/useMemoryConsolidation";
import type { ConsolidationSource, ConsolidationStep } from "@/types/memoryConsolidation";

interface Props {
  topicLabel: string;
  topicId?: string | null;
  source?: ConsolidationSource;
  triggerEventId?: string | null;
  contextSummary?: string;
  onCompleted?: (result: { mastery_score: number; false_confidence_flag: boolean }) => void;
}

const STEP_LABEL: Record<ConsolidationStep, string> = {
  retrieval: "1 · Recall ativo",
  connective_summary: "2 · Resumo conectivo",
  metacog: "3 · Metacognição",
  confidence: "4 · Confiança",
};

const ORDER: ConsolidationStep[] = ["retrieval", "connective_summary", "metacog", "confidence"];

export function MemoryConsolidationCard({
  topicLabel,
  topicId,
  source = "tutor_v3",
  triggerEventId,
  contextSummary,
  onCompleted,
}: Props) {
  const { session, prompts, loading, error, result, start, respond, complete, reset } = useMemoryConsolidation();
  const [stepIdx, setStepIdx] = useState(0);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState(60);
  const [stepFeedback, setStepFeedback] = useState<string>("");

  useEffect(() => {
    // Inicia 1x ao montar.
    if (!session) {
      start({
        topic_label: topicLabel,
        topic_id: topicId ?? null,
        source,
        trigger_event_id: triggerEventId ?? null,
        context_summary: contextSummary,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicLabel]);

  useEffect(() => {
    if (result) onCompleted?.({ mastery_score: result.mastery_score, false_confidence_flag: result.false_confidence_flag });
  }, [result, onCompleted]);

  const currentStep = ORDER[stepIdx];
  const isLast = stepIdx === ORDER.length - 1;

  const handleNext = async () => {
    if (!session) return;
    try {
      if (currentStep === "confidence") {
        await respond("confidence", String(confidence), confidence);
      } else {
        const r = await respond(currentStep, text);
        setStepFeedback(r.feedback || "");
      }
      setText("");
      if (isLast) {
        await complete();
      } else {
        setStepIdx((i) => i + 1);
        setStepFeedback("");
      }
    } catch {/* error já vai pro state */}
  };

  if (result) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Consolidação concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Domínio: {result.mastery_score}</Badge>
            <Badge variant="secondary">Confiança: {result.confidence_score}</Badge>
            <Badge variant="secondary">Metacog: {result.metacog_quality}</Badge>
            {result.false_confidence_flag && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Falsa confiança
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {result.emitted_events.length} evento(s) emitido(s) para Planner / FSRS / Error Bank.
          </p>
          <Button variant="outline" size="sm" onClick={() => { reset(); setStepIdx(0); }}>
            Nova consolidação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-primary" />
          Consolidação de memória
          <Badge variant="outline" className="ml-auto text-xs">{STEP_LABEL[currentStep]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!session && loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparando...
          </div>
        )}

        {prompts && (
          <p className="text-sm leading-relaxed">{prompts[currentStep]}</p>
        )}

        {currentStep === "confidence" ? (
          <div className="space-y-2">
            <Slider
              value={[confidence]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setConfidence(v[0])}
            />
            <p className="text-xs text-muted-foreground">Confiança: {confidence}/100</p>
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sua resposta..."
            rows={4}
            disabled={loading}
          />
        )}

        {stepFeedback && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic">
            {stepFeedback}
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Etapa {stepIdx + 1} de {ORDER.length}</p>
          <Button
            onClick={handleNext}
            disabled={loading || (!session) || (currentStep !== "confidence" && text.trim().length < 5)}
            size="sm"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {isLast ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default MemoryConsolidationCard;
