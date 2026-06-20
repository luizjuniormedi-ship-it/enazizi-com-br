import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, CheckCircle2, AlertTriangle, Sparkles, Target } from "lucide-react";
import { useMemoryConsolidation } from "@/hooks/useMemoryConsolidation";
import type {
  CompleteSessionResult,
  ConsolidationSource,
  ConsolidationStep,
} from "@/types/memoryConsolidation";

interface Props {
  topicLabel: string;
  topicId?: string | null;
  source?: ConsolidationSource;
  triggerEventId?: string | null;
  contextSummary?: string;
  specialty?: string;
  /** 0-100. Incidência ENAMED/ENARE/Revalida. Direciona o rigor. */
  highYieldScore?: number;
  enamedRelevance?: number;
  recentMistakes?: string[];
  onCompleted?: (result: CompleteSessionResult) => void;
}

const STEP_LABEL: Record<ConsolidationStep, string> = {
  retrieval: "Recall ativo",
  generation_effect: "Ensine como um interno",
  clinical_recall: "Cenário clínico",
  connective_summary: "Resumo conectivo",
  metacog: "Metacognição",
  confidence: "Confiança",
};

const RIGOR_LABEL = {
  full: "Rigor pleno (high-yield)",
  standard: "Rigor padrão",
  simplified: "Rigor leve",
} as const;

export function MemoryConsolidationCard({
  topicLabel,
  topicId,
  source = "tutor_v3",
  triggerEventId,
  contextSummary,
  specialty,
  highYieldScore,
  enamedRelevance,
  recentMistakes,
  onCompleted,
}: Props) {
  const {
    session, prompts, steps, rigor, loading, error, result,
    start, respond, complete, reset,
  } = useMemoryConsolidation();
  const [stepIdx, setStepIdx] = useState(0);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState(3); // Likert 1-5
  const [stepFeedback, setStepFeedback] = useState("");

  useEffect(() => {
    if (!session) {
      start({
        topic_label: topicLabel,
        topic_id: topicId ?? null,
        source,
        trigger_event_id: triggerEventId ?? null,
        context_summary: contextSummary,
        specialty,
        high_yield_score: highYieldScore,
        enamed_relevance: enamedRelevance,
        recent_mistakes: recentMistakes,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicLabel]);

  useEffect(() => { if (result) onCompleted?.(result); }, [result, onCompleted]);

  const currentStep = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const totalSteps = steps.length || 1;

  const restart = () => {
    reset();
    setStepIdx(0);
    setText("");
    setConfidence(3);
    setStepFeedback("");
    start({
      topic_label: topicLabel,
      topic_id: topicId ?? null,
      source,
      trigger_event_id: triggerEventId ?? null,
      context_summary: contextSummary,
      specialty,
      high_yield_score: highYieldScore,
      enamed_relevance: enamedRelevance,
      recent_mistakes: recentMistakes,
    }).catch(() => {});
  };

  const handleNext = async () => {
    if (!session || !currentStep) return;
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
    } catch { /* erro já vai pro state */ }
  };

  const progressLabel = useMemo(
    () => currentStep ? `Etapa ${stepIdx + 1} de ${totalSteps} · ${STEP_LABEL[currentStep]}` : "",
    [currentStep, stepIdx, totalSteps],
  );

  // ----------- RESULTADO -----------
  if (result) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Consolidação concluída
            <Badge variant="outline" className="ml-auto">{result.cognitive_state}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Domínio: {result.mastery_score}</Badge>
            <Badge variant="secondary">Confiança: {result.confidence_score}</Badge>
            <Badge variant="secondary">Metacog: {result.metacog_quality}</Badge>
            <Badge variant={result.advance_allowed ? "default" : "destructive"}>
              {result.advance_allowed ? "Pode avançar" : result.micro_reinforcement_required ? "Micro-reforço" : "Voltar ao conteúdo"}
            </Badge>
            {result.false_confidence && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Falsa confiança
              </Badge>
            )}
          </div>

          {/* ENAMED takeaways */}
          {(result.enamed_takeaways?.must_memorize?.length > 0 ||
            result.enamed_takeaways?.cannot_forget_conduct) && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Target className="h-3 w-3" /> ENAMED takeaways
              </p>
              {result.enamed_takeaways.must_memorize?.length > 0 && (
                <div>
                  <p className="text-xs font-medium">O que preciso gravar</p>
                  <ul className="text-xs list-disc list-inside text-muted-foreground">
                    {result.enamed_takeaways.must_memorize.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {result.enamed_takeaways.exam_pattern?.length > 0 && (
                <div>
                  <p className="text-xs font-medium">Como cai na prova</p>
                  <ul className="text-xs list-disc list-inside text-muted-foreground">
                    {result.enamed_takeaways.exam_pattern.slice(0, 2).map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {result.enamed_takeaways.trap && (
                <p className="text-xs"><span className="font-medium">Pegadinha:</span> {result.enamed_takeaways.trap}</p>
              )}
              {result.enamed_takeaways.cannot_forget_conduct && (
                <p className="text-xs"><span className="font-medium">Conduta:</span> {result.enamed_takeaways.cannot_forget_conduct}</p>
              )}
            </div>
          )}

          {result.knowledge_gaps.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.knowledge_gaps.length} lacuna(s) detectada(s) · {result.fsrs_cards_to_create.length} flashcard(s) sugerido(s) · {result.emitted_events.length} evento(s) emitido(s).
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={restart}>Nova consolidação</Button>
            {result.micro_reinforcement_required && (
              <Button size="sm" className="gap-1">
                <Sparkles className="h-3 w-3" /> Micro-reforço
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ----------- FLUXO -----------
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-primary" />
          Consolidação de memória
          {rigor && (
            <Badge variant="outline" className="ml-auto text-xs">{RIGOR_LABEL[rigor]}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!session && loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparando consolidação...
          </div>
        )}

        {currentStep && prompts[currentStep] && (
          <p className="text-sm leading-relaxed">{prompts[currentStep]}</p>
        )}

        {currentStep === "confidence" ? (
          <div className="space-y-2">
            <Slider
              value={[confidence]}
              min={1}
              max={5}
              step={1}
              onValueChange={(v) => setConfidence(v[0])}
            />
            <p className="text-xs text-muted-foreground">
              {confidence} / 5 ·{" "}
              {["Não entendi", "Muito inseguro", "Entendi parcialmente", "Consigo resolver questões", "Consigo ensinar"][confidence - 1]}
            </p>
          </div>
        ) : currentStep ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sua resposta — sem consultar material..."
            rows={5}
            disabled={loading}
          />
        ) : null}

        {stepFeedback && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 italic">
            {stepFeedback}
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">{progressLabel}</p>
          <Button
            onClick={handleNext}
            disabled={loading || !session || !currentStep || (currentStep !== "confidence" && text.trim().length < 5)}
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
