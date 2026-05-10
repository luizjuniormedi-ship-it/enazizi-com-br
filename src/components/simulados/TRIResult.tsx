import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, BarChart3, AlertTriangle, GraduationCap, RotateCcw,
  Bookmark, BookOpen, Loader2, TrendingUp, Clock, Target, Trophy, Users,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { XP_REWARDS } from "@/hooks/useGamification";
import { EXAM_PROFILES } from "@/lib/realExamDistribution";
import {
  type TRIQuestionResult,
  estimateTheta,
  calculateTRIScore,
  estimateTRICutoff,
  simulateRanking,
  triDiagnosis,
} from "@/lib/triEngine";
import type { SimQuestion } from "./SimuladoExam";

interface TRIResultProps {
  questions: SimQuestion[];
  selectedAnswers: Record<number, number>;
  triResults: TRIQuestionResult[];
  onNewSimulado: () => void;
  onRetryErrors: () => void;
  flaggedQuestions: number[];
  elapsedSeconds?: number;
  realExamProfile: string;
}

const TRIResult = ({
  questions,
  selectedAnswers,
  triResults,
  onNewSimulado,
  onRetryErrors,
  flaggedQuestions,
  elapsedSeconds,
  realExamProfile,
}: TRIResultProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generatingGuide, setGeneratingGuide] = useState<string | null>(null);

  const profile = EXAM_PROFILES[realExamProfile] || EXAM_PROFILES.GERAL;
  const correctCount = triResults.filter(r => r.correct).length;
  const rawPct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  // TRI calculations
  const theta = estimateTheta(triResults);
  const { triScore, equivalentPct, itemAnalysis } = calculateTRIScore(theta, triResults);
  const { cutoffScore, cutoffTheta } = estimateTRICutoff(realExamProfile);
  const ranking = simulateRanking(triScore, realExamProfile);
  const topics = questions.map(q => q.topic);
  const diagnosis = triDiagnosis(triResults, topics);

  const approved = triScore >= cutoffScore;
  const distance = ranking.distanceFromCutoff;

  const avgTimePerQuestion = elapsedSeconds && Object.keys(selectedAnswers).length > 0
    ? Math.round(elapsedSeconds / Object.keys(selectedAnswers).length)
    : null;

  // Top 5 items that cost the most
  const costliestErrors = [...itemAnalysis]
    .filter(i => !i.correct)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 5);

  const handleStudyWithTutor = (q: SimQuestion) => {
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `Errei uma questão sobre "${q.topic}". O enunciado era: "${q.statement.slice(0, 200)}". A resposta correta era "${q.options[q.correct]}". Me explique este tema em detalhes seguindo o protocolo ENAZIZI.`,
        fromErrorBank: true,
      },
    });
  };

  const handleGenerateGuide = async (area: string) => {
    setGeneratingGuide(area);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: `Gere um guia de estudo focado em ${area} para residência médica. O aluno teve desempenho TRI abaixo do esperado nessa área.` }],
          }),
        },
      );
      if (res.ok) {
        toast({ title: `Guia de ${area} gerado!`, description: "Acesse em Guias de Estudo." });
      } else {
        toast({ title: "Erro ao gerar guia", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao gerar guia", variant: "destructive" });
    } finally {
      setGeneratingGuide(null);
    }
  };

  const errorQuestions = questions
    .map((q, i) => ({ q, idx: i }))
    .filter(({ idx }) => selectedAnswers[idx] !== questions[idx].correct);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center py-6">
        <Brain className="h-16 w-16 text-violet-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">Resultado TRI — {profile.name}</h1>
        <div className={`text-5xl font-black ${approved ? "text-green-500" : "text-destructive"}`}>
          {triScore}
        </div>
        <p className="text-sm text-muted-foreground mt-1">Nota TRI (escala 0-1000)</p>
        <p className="text-muted-foreground mt-2">
          {correctCount} de {questions.length} questões corretas ({rawPct}% bruto → <strong>{equivalentPct}%</strong> ponderado)
        </p>
        <p className="text-xs text-muted-foreground mt-1">θ (habilidade) = {theta} · +{XP_REWARDS.simulado_completed} XP ganhos 🎉</p>

        <div className={`mt-4 inline-block px-4 py-2 rounded-full text-sm font-semibold ${
          approved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {approved ? "✅" : "❌"} {approved ? "Aprovado" : "Abaixo do corte"} — Nota de corte: {cutoffScore}
        </div>

        {avgTimePerQuestion && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Tempo médio: <strong>{avgTimePerQuestion}s</strong> por questão</span>
          </div>
        )}
      </div>

      {/* ── Ranking e Posição ── */}
      <div className="glass-card p-6 border-violet-500/20">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-500" /> Ranking Estimado — {profile.name}
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Sua Nota TRI</p>
            <p className="text-2xl font-black text-primary">{triScore}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Nota de Corte TRI</p>
            <p className="text-2xl font-black text-amber-600">{cutoffScore}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Percentil</p>
            <p className="text-2xl font-black text-primary">{ranking.percentile}º</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Posição Estimada</p>
            <p className="text-lg font-bold text-primary">
              {ranking.estimatedPosition.toLocaleString()}º / {ranking.totalCandidates.toLocaleString()}
            </p>
          </div>
        </div>

        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          distance >= 0 ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
        }`}>
          {distance >= 0 ? <ArrowUp className="h-4 w-4 text-green-600" /> : <ArrowDown className="h-4 w-4 text-destructive" />}
          <p className="text-sm">
            {distance >= 0
              ? `Você está ${distance} pontos acima da nota de corte. Top ${100 - ranking.percentile}% dos candidatos.`
              : `Você está ${Math.abs(distance)} pontos abaixo da nota de corte. Foque nas áreas críticas.`}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">* Estimativas baseadas em modelo TRI 3PL com distribuição normal dos candidatos.</p>
      </div>

      {/* ── Diagnóstico TRI por Tema ── */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Diagnóstico TRI por Tema
        </h3>
        <div className="space-y-4">
          {diagnosis.map(d => {
            const pct = d.totalItems > 0 ? Math.round((d.correctItems / d.totalItems) * 100) : 0;
            const levelColor = d.criticalLevel === "dominado" ? "text-green-500" : d.criticalLevel === "revisar" ? "text-yellow-600" : "text-destructive";
            const levelBg = d.criticalLevel === "dominado" ? "bg-green-500" : d.criticalLevel === "revisar" ? "bg-yellow-500" : "bg-destructive";
            return (
              <div key={d.area}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="font-medium">{d.area}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${levelColor} ${levelBg}/10`}>
                      {d.criticalLevel === "dominado" ? "Dominado" : d.criticalLevel === "revisar" ? "Revisar" : "Crítico"}
                    </span>
                    <span className="text-muted-foreground text-xs">{d.correctItems}/{d.totalItems} ({pct}%)</span>
                    <span className="text-xs text-muted-foreground">b̄={d.avgDifficulty}</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-destructive"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {d.criticalLevel === "critico" && (
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive"
                      onClick={() => handleGenerateGuide(d.area)}
                      disabled={generatingGuide === d.area}
                    >
                      {generatingGuide === d.area ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                      Gerar Guia
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="gap-1.5 text-xs"
                      onClick={() => handleStudyWithTutor({ topic: d.area, statement: `Preciso revisar ${d.area}`, options: [], correct: 0 })}
                    >
                      <GraduationCap className="h-3.5 w-3.5" /> Tutor IA
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Questões que mais custaram (TRI Impact) ── */}
      {costliestErrors.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-destructive" /> Erros de Maior Impacto TRI
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Estas questões tiveram o maior peso negativo na sua nota TRI. Errar questões "fáceis" custa mais que errar difíceis.
          </p>
          <div className="space-y-3">
            {costliestErrors.map((item, i) => {
              const q = questions[item.index];
              if (!q) return null;
              return (
                <div key={item.index} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">#{i + 1} — {q.topic}</span>
                    <span className="text-xs text-destructive font-bold">Impacto: {item.impact}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{q.statement.slice(0, 150)}...</p>
                  <p className="text-xs mt-1">
                    Peso: <strong>{(item.weight * 100).toFixed(1)}%</strong> da prova
                  </p>
                  <Button variant="outline" size="sm" className="gap-1.5 mt-1 text-xs" onClick={() => handleStudyWithTutor(q)}>
                    <GraduationCap className="h-3.5 w-3.5" /> Estudar
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Caderno de Erros ── */}
      {errorQuestions.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Caderno de Erros ({errorQuestions.length})
            </h3>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onRetryErrors}>
              <RotateCcw className="h-3.5 w-3.5" /> Refazer erros
            </Button>
          </div>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {errorQuestions.map(({ q, idx }) => (
              <div key={idx} className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-sm font-medium mb-2 line-clamp-3">{q.statement}</p>
                <p className="text-xs text-muted-foreground mb-1">
                  {selectedAnswers[idx] !== undefined ? (
                    <>Sua: <span className="text-destructive font-medium">{String.fromCharCode(65 + selectedAnswers[idx])}) {q.options[selectedAnswers[idx]]}</span> · </>
                  ) : <span className="text-yellow-600 font-medium">Não respondida · </span>}
                  Correta: <span className="text-green-500 font-medium">{String.fromCharCode(65 + q.correct)}) {q.options[q.correct]}</span>
                </p>
                {q.explanation && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 mt-2">
                    <p className="text-xs text-muted-foreground">{q.explanation}</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 mt-2 text-xs" onClick={() => handleStudyWithTutor(q)}>
                  <GraduationCap className="h-3.5 w-3.5" /> Estudar com Tutor IA
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskCompletionCard
        title="Simulado TRI Concluído!"
        subtitle={`Nota TRI: ${triScore}/1000 · Percentil ${ranking.percentile}º · ${approved ? "Aprovado!" : "Continue estudando!"}`}
        secondaryLabel="Novo Simulado"
        onSecondary={onNewSimulado}
        tertiaryLabel="Refazer erros"
        onTertiary={errorQuestions.length > 0 ? onRetryErrors : undefined}
      />
    </div>
  );
};

export default TRIResult;
