import { useState, lazy, Suspense } from "react";
import type { AdaptiveMeta } from "@/hooks/useAdaptiveSimulado";
import { useNavigate } from "react-router-dom";
const ModalityAnalyticsPanel = lazy(() => import("@/components/simulados/ModalityAnalyticsPanel"));
const AdaptiveProgressDashboard = lazy(() => import("@/components/dashboard/AdaptiveProgressDashboard"));
import { Award, BarChart3, AlertTriangle, GraduationCap, RotateCcw, Bookmark, BookOpen, Loader2, TrendingUp, Clock, Skull, Target, Trophy, Users } from "lucide-react";
import TaskCompletionCard from "@/components/study/TaskCompletionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { XP_REWARDS } from "@/hooks/useGamification";
import { EXAM_PROFILES, estimatePercentile, estimateGrade } from "@/lib/realExamDistribution";
import type { SimQuestion } from "./SimuladoExam";
import type { SimuladoMode } from "./SimuladoSetup";

interface SimuladoResultProps {
  questions: SimQuestion[];
  selectedAnswers: Record<number, number>;
  onNewSimulado: () => void;
  onRetryErrors: () => void;
  flaggedQuestions: number[];
  mode: SimuladoMode;
  elapsedSeconds?: number;
  realExamProfile?: string;
  adaptiveMeta?: AdaptiveMeta | null;
}

const SimuladoResult = ({ questions, selectedAnswers, onNewSimulado, onRetryErrors, flaggedQuestions, mode, elapsedSeconds, realExamProfile, adaptiveMeta }: SimuladoResultProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generatingGuide, setGeneratingGuide] = useState<string | null>(null);

  const correctCount = questions.reduce((acc, q, i) => acc + (selectedAnswers[i] === q.correct ? 1 : 0), 0);
  const totalAnswered = Object.keys(selectedAnswers).length;
  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  const areaResults: Record<string, { correct: number; total: number }> = {};
  const errorQuestions: { q: SimQuestion; idx: number }[] = [];

  questions.forEach((q, i) => {
    if (!areaResults[q.topic]) areaResults[q.topic] = { correct: 0, total: 0 };
    areaResults[q.topic].total++;
    if (selectedAnswers[i] === q.correct) {
      areaResults[q.topic].correct++;
    } else {
      errorQuestions.push({ q, idx: i });
    }
  });

  const flaggedItems = flaggedQuestions
    .filter(i => i < questions.length)
    .map(i => ({ q: questions[i], idx: i }));

  const avgTimePerQuestion = elapsedSeconds && totalAnswered > 0
    ? Math.round(elapsedSeconds / totalAnswered)
    : null;

  // Real exam competitive analysis
  const isProvaReal = mode === "prova_real" && realExamProfile;
  const profile = isProvaReal ? (EXAM_PROFILES[realExamProfile] || EXAM_PROFILES.GERAL) : null;
  const cutoff = profile?.cutoffEstimate || 60;
  const percentile = profile ? estimatePercentile(pct, cutoff) : null;
  const gradeInfo = profile ? estimateGrade(pct, cutoff) : null;

  const getDiagnosis = (areaPct: number) => {
    if (areaPct >= 80) return { label: "Dominado", color: "text-green-500", bg: "bg-green-500" };
    if (areaPct >= 60) return { label: "Revisar", color: "text-yellow-600", bg: "bg-yellow-500" };
    return { label: "Crítico", color: "text-destructive", bg: "bg-destructive" };
  };

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
            messages: [{ role: "user", content: `Gere um guia de estudo focado em ${area} para residência médica. O aluno teve menos de 60% de acerto nessa área.` }],
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

  const isExtremo = mode === "extremo";
  const sortedAreas = Object.entries(areaResults).sort((a, b) => {
    const pctA = a[1].total > 0 ? (a[1].correct / a[1].total) * 100 : 0;
    const pctB = b[1].total > 0 ? (b[1].correct / b[1].total) * 100 : 0;
    return pctA - pctB;
  });
  const weakAreas = sortedAreas.filter(([, v]) => v.total > 0 && (v.correct / v.total) * 100 < 60);

  // Identify topics that cost the most points
  const impactAreas = sortedAreas
    .map(([area, v]) => ({ area, missed: v.total - v.correct, total: v.total, pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0 }))
    .filter(a => a.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto" data-testid="result-screen">
      <div className="text-center py-6">
        {isProvaReal ? (
          <Trophy className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        ) : isExtremo ? (
          <Skull className="h-16 w-16 text-destructive mx-auto mb-4" />
        ) : (
          <Award className="h-16 w-16 text-primary mx-auto mb-4" />
        )}
        <h1 className="text-3xl font-bold mb-2">
          {isProvaReal ? `Prova Real ${profile?.name} Concluída!` : isExtremo ? "Prova Extrema Concluída!" : "Simulado Concluído!"}
        </h1>
        <div className={`text-5xl font-black ${
          isProvaReal ? (gradeInfo?.approved ? "text-green-500" : "text-destructive") :
          isExtremo && pct < 60 ? "text-destructive" : "text-primary"
        }`}>{pct}%</div>
        <p className="text-muted-foreground mt-2">{correctCount} de {questions.length} questões corretas</p>
        {totalAnswered < questions.length && (
          <p className="text-xs text-yellow-600 mt-1">{questions.length - totalAnswered} questões não respondidas</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">+{XP_REWARDS.simulado_completed} XP ganhos 🎉</p>

        {/* Prova Real: Grade badge */}
        {isProvaReal && gradeInfo && (
          <div className={`mt-4 inline-block px-4 py-2 rounded-full text-sm font-semibold ${
            gradeInfo.approved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}>
            {gradeInfo.approved ? "✅" : "❌"} Nota {gradeInfo.grade} — {gradeInfo.label}
          </div>
        )}

        {/* Extreme verdict */}
        {isExtremo && !isProvaReal && (
          <div className={`mt-4 inline-block px-4 py-2 rounded-full text-sm font-semibold ${
            pct >= 80 ? "bg-emerald-100 text-emerald-700" :
            pct >= 60 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {pct >= 80 ? "🏆 Aprovado com distinção" :
             pct >= 60 ? "✅ Aprovado — mas pode melhorar" :
             "⚠️ Reprovado — foco nas áreas fracas"}
          </div>
        )}

        {/* Time stats */}
        {avgTimePerQuestion && (
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Tempo médio: <strong>{avgTimePerQuestion}s</strong> por questão</span>
            {avgTimePerQuestion < 30 && <span className="text-yellow-600 text-xs">(muito rápido)</span>}
            {avgTimePerQuestion > 300 && <span className="text-yellow-600 text-xs">(muito lento)</span>}
          </div>
        )}

        {/* Question composition summary */}
        {(() => {
          const imageQs = questions.filter(q => q._isImageQuestion);
          const textQs = questions.filter(q => !q._isImageQuestion);
          const excellentCount = questions.filter(q => q._editorialGrade === "excellent").length;
          const goodCount = questions.filter(q => q._editorialGrade === "good").length;
          if (imageQs.length === 0 && excellentCount === 0) return null;
          return (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {imageQs.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  🖼️ {imageQs.length} multimodal
                </span>
              )}
              {textQs.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  📝 {textQs.length} textual
                </span>
              )}
              {excellentCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">
                  ⭐ {excellentCount} excellent
                </span>
              )}
              {goodCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">
                  ✅ {goodCount} good
                </span>
              )}
            </div>
          );
        })()}

        {/* Adaptive strategy summary */}
        {adaptiveMeta && (
          <div className="mt-4 glass-card p-4 text-left text-sm space-y-2 max-w-md mx-auto">
            <h4 className="font-semibold flex items-center gap-1.5 text-primary">
              <Target className="h-4 w-4" /> Estratégia Adaptativa
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Foco:</span>
              <span className="font-medium">{adaptiveMeta.focus}</span>
              <span className="text-muted-foreground">Fraqueza alvo:</span>
              <span className="font-medium">{adaptiveMeta.weakness_targeted}</span>
              <span className="text-muted-foreground">Estratégia:</span>
              <span className="font-medium">{adaptiveMeta.strategy}</span>
            </div>
            {adaptiveMeta.distribution && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(adaptiveMeta.distribution.difficulty || {}).map(([k, v]) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {k}: {v}
                  </span>
                ))}
              </div>
            )}
            {(() => {
              const imageQs = questions.filter(q => q._isImageQuestion).length;
              const textQs = questions.length - imageQs;
              const excellent = questions.filter(q => q._editorialGrade === "excellent").length;
              const good = questions.filter(q => q._editorialGrade === "good").length;
              const fromBank = questions.filter(q => (q as any)._source === "bank").length;
              const generated = questions.length - fromBank;
              return (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground pt-1 border-t border-border">
                  <span>🖼️ Multimodal: <strong className="text-foreground">{imageQs}</strong></span>
                  <span>📝 Textual: <strong className="text-foreground">{textQs}</strong></span>
                  <span>⭐ Excellent: <strong className="text-foreground">{excellent}</strong></span>
                  <span>✅ Good: <strong className="text-foreground">{good}</strong></span>
                  <span>🏦 Do banco: <strong className="text-foreground">{fromBank}</strong></span>
                  <span>🤖 Geradas: <strong className="text-foreground">{generated}</strong></span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Prova Real: Competitive Analysis ── */}
      {isProvaReal && profile && percentile !== null && gradeInfo && (
        <div className="glass-card p-6 border-amber-500/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-500" /> Análise Competitiva — {profile.name}
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-lg bg-secondary/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Sua Nota</p>
              <p className="text-2xl font-black text-primary">{pct}%</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Nota de Corte Estimada</p>
              <p className="text-2xl font-black text-amber-600">{cutoff}%</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Percentil Estimado</p>
              <p className="text-2xl font-black text-primary">{percentile}º</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Posição Relativa</p>
              <p className="text-lg font-bold text-primary">Top {100 - percentile}%</p>
            </div>
          </div>
          <div className={`p-3 rounded-lg ${gradeInfo.approved ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <p className="text-sm">{gradeInfo.message}</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">* Estimativas baseadas em análise estatística de provas anteriores. Valores aproximados.</p>
        </div>
      )}

      {/* ── Prova Real: Impact Analysis ── */}
      {isProvaReal && impactAreas.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-destructive" /> Temas que Mais Derrubaram
          </h3>
          <div className="space-y-3">
            {impactAreas.map(({ area, missed, total, pct: areaPct }, i) => (
              <div key={area} className="flex items-center gap-3">
                <span className="text-lg font-black text-destructive w-6">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{area}</span>
                    <span className="text-destructive font-semibold">-{missed} questões ({areaPct}% acerto)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div className={`h-full rounded-full ${areaPct >= 60 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${areaPct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Focar nestes {impactAreas.length} temas poderia aumentar sua nota em até +{impactAreas.reduce((s, a) => s + a.missed, 0)} pontos.
          </p>
        </div>
      )}

      {/* Area breakdown with diagnosis */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Desempenho por área
        </h3>
        <div className="space-y-4">
          {Object.entries(areaResults).map(([area, { correct, total }]) => {
            const areaPct = Math.round((correct / total) * 100);
            const diag = getDiagnosis(areaPct);
            return (
              <div key={area}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="font-medium">{area}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diag.color} ${diag.bg}/10`}>{diag.label}</span>
                    <span className="text-muted-foreground">{correct}/{total} ({areaPct}%)</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-secondary">
                  <div className={`h-full rounded-full transition-all ${areaPct >= 80 ? "bg-green-500" : areaPct >= 60 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${areaPct}%` }} />
                </div>
                {areaPct < 60 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs mt-1 text-destructive"
                    onClick={() => handleGenerateGuide(area)}
                    disabled={generatingGuide === area}
                  >
                    {generatingGuide === area ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                    Gerar Guia de Estudo
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Visual Performance Breakdown ── */}
      {(() => {
        const IMAGE_TYPE_LABELS: Record<string, string> = {
          ecg: "❤️ ECG", xray: "🫁 RX Tórax", ct: "🧠 TC", us: "📡 US",
          dermatology: "🩹 Dermato", pathology: "🔬 Patologia", ophthalmology: "👁️ Oftalmo",
        };
        const imgQs = questions.filter((q: any) => q._isImageQuestion && q.image_type);
        if (imgQs.length === 0) return null;

        const byType: Record<string, { correct: number; total: number }> = {};
        imgQs.forEach((q: any) => {
          const t = q.image_type?.toLowerCase() || "other";
          if (!byType[t]) byType[t] = { correct: 0, total: 0 };
          byType[t].total++;
          const idx = questions.indexOf(q);
          if (selectedAnswers[idx] === q.correct) byType[t].correct++;
        });

        const textQs = questions.filter((q: any) => !q._isImageQuestion);
        const textCorrect = textQs.filter((q, i) => {
          const idx = questions.indexOf(q);
          return selectedAnswers[idx] === q.correct;
        }).length;
        const textAcc = textQs.length > 0 ? Math.round((textCorrect / textQs.length) * 100) : 0;
        const imgCorrect = imgQs.filter((q) => {
          const idx = questions.indexOf(q);
          return selectedAnswers[idx] === q.correct;
        }).length;
        const imgAcc = imgQs.length > 0 ? Math.round((imgCorrect / imgQs.length) * 100) : 0;

        const sorted = Object.entries(byType).sort((a, b) => {
          const accA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
          const accB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
          return accA - accB;
        });
        const weakest = sorted[0];
        const strongest = sorted[sorted.length - 1];

        return (
          <div className="glass-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Desempenho Visual
            </h3>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                🖼️ Imagem: {imgAcc}% ({imgCorrect}/{imgQs.length})
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                📝 Texto: {textAcc}% ({textCorrect}/{textQs.length})
              </span>
              {imgAcc < textAcc - 15 && (
                <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                  ⚠️ Você foi melhor em texto do que em imagem
                </span>
              )}
              {imgAcc > textAcc + 15 && (
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                  ✨ Você foi melhor em imagem do que em texto
                </span>
              )}
            </div>

            {/* Per image type */}
            <div className="space-y-3">
              {sorted.map(([type, { correct: c, total: t }]) => {
                const acc = Math.round((c / t) * 100);
                const label = IMAGE_TYPE_LABELS[type] || type.toUpperCase();
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">{c}/{t} ({acc}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <div className={`h-full rounded-full transition-all ${acc >= 80 ? "bg-emerald-500" : acc >= 60 ? "bg-yellow-500" : "bg-destructive"}`} style={{ width: `${acc}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insight messages */}
            <div className="mt-4 space-y-1">
              {weakest && weakest[1].total > 0 && (weakest[1].correct / weakest[1].total) < 0.6 && (
                <p className="text-xs text-destructive">
                  🎯 Seu ponto crítico visual: {IMAGE_TYPE_LABELS[weakest[0]] || weakest[0]} ({Math.round((weakest[1].correct / weakest[1].total) * 100)}%)
                </p>
              )}
              {strongest && strongest[1].total > 0 && (strongest[1].correct / strongest[1].total) >= 0.75 && (
                <p className="text-xs text-emerald-600">
                  💪 Melhor desempenho: {IMAGE_TYPE_LABELS[strongest[0]] || strongest[0]} ({Math.round((strongest[1].correct / strongest[1].total) * 100)}%)
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Extreme Mode: Corrective Action Plan */}
      {(isExtremo || isProvaReal) && weakAreas.length > 0 && (
        <div className="glass-card p-6 border-destructive/20">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-destructive" /> Plano Corretivo Pós-Prova
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Áreas com menos de 60% de acerto precisam de atenção imediata. Use o plano abaixo para direcionar seus estudos.
          </p>
          <div className="space-y-3">
            {weakAreas.map(([area, { correct, total }], i) => {
              const areaPct = Math.round((correct / total) * 100);
              return (
                <div key={area} className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{i + 1}. {area}</span>
                    <span className="text-xs text-destructive font-bold">{areaPct}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {areaPct < 30
                      ? "Base teórica insuficiente. Comece pelo Tutor IA com revisão completa do tema."
                      : areaPct < 50
                      ? "Conceitos parciais. Revise os erros e pratique mais questões focadas."
                      : "Quase lá. Foque nas pegadinhas e casos clínicos complexos."}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-3 rounded-lg border-white/10 bg-white/5 font-black uppercase tracking-widest text-[9px] gap-1" 
                      onClick={() => handleStudyWithTutor({ topic: area, statement: `Preciso revisar ${area} após resultado baixo na prova`, options: [], correct: 0 })}
                    >
                      <GraduationCap className="h-3 w-3" /> TUTOR IA
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-3 rounded-lg border-white/10 bg-white/5 font-black uppercase tracking-widest text-[9px] gap-1" 
                      onClick={() => navigate(`/dashboard/simulados?sc_topic=${encodeURIComponent(area)}&sc_objective=reforço`)}
                    >
                      <BarChart3 className="h-3 w-3" /> QUESTÕES
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flagged questions */}
      {flaggedItems.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-yellow-500" /> Questões Marcadas ({flaggedItems.length})
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {flaggedItems.map(({ q, idx }) => (
              <div key={idx} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-sm font-medium mb-1">{q.statement.slice(0, 200)}{q.statement.length > 200 ? "..." : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAnswers[idx] !== undefined ? (
                    <>Sua: <span className={selectedAnswers[idx] === q.correct ? "text-green-500 font-medium" : "text-destructive font-medium"}>{String.fromCharCode(65 + selectedAnswers[idx])}</span> • </>
                  ) : <span className="text-yellow-600">Não respondida • </span>}
                  Correta: <span className="text-green-500 font-medium">{String.fromCharCode(65 + q.correct)}</span>
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 rounded-lg border-white/10 bg-white/5 font-black uppercase tracking-widest text-[9px] gap-1.5 mt-1" 
                  onClick={() => handleStudyWithTutor(q)}
                >
                  <GraduationCap className="h-3.5 w-3.5" /> ESTUDAR COM TUTOR IA
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error notebook */}
      {errorQuestions.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Caderno de Erros ({errorQuestions.length})
            </h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 px-4 rounded-xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-[10px] gap-1.5" 
              onClick={onRetryErrors}
            >
              <RotateCcw className="h-3.5 w-3.5" /> REFAZER SÓ OS ERROS
            </Button>
          </div>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {errorQuestions.map(({ q, idx }) => (
              <div key={idx} className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-sm font-medium mb-2">{q.statement}</p>
                <p className="text-xs text-muted-foreground mb-1">
                  {selectedAnswers[idx] !== undefined ? (
                    <>Sua resposta: <span className="text-destructive font-medium">{String.fromCharCode(65 + selectedAnswers[idx])}) {q.options[selectedAnswers[idx]]}</span>{" • "}</>
                  ) : (
                    <span className="text-yellow-600 font-medium">Não respondida • </span>
                  )}
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

      {/* Modality Analytics */}
      <Suspense fallback={null}>
        <ModalityAnalyticsPanel />
      </Suspense>

      <Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}>
        <AdaptiveProgressDashboard />
      </Suspense>

      <TaskCompletionCard
        title={isProvaReal ? "Prova Real concluída!" : "Simulado concluído!"}
        subtitle={`Você acertou ${correctCount} de ${questions.length} questões (${pct}%). ${isProvaReal && gradeInfo ? (gradeInfo.approved ? "Parabéns, aprovado!" : "Continue estudando!") : "Seu progresso foi atualizado."}`}
        secondaryLabel="Novo Simulado"
        onSecondary={onNewSimulado}
        tertiaryLabel="Refazer erros"
        onTertiary={errorQuestions.length > 0 ? onRetryErrors : undefined}
      />
    </div>
  );
};

export default SimuladoResult;
