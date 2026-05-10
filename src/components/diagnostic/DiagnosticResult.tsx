import { Award, GraduationCap, TrendingUp, TrendingDown, Clock, Target, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import type { AnswerRecord, DiagQuestion } from "./DiagnosticExam";

interface DiagnosticResultProps {
  questions: DiagQuestion[];
  answers: AnswerRecord[];
  xpEarned?: number;
  previousTopicResults?: Record<string, number>;
}

const DiagnosticResult = ({ questions, answers, xpEarned = 0, previousTopicResults = {} }: DiagnosticResultProps) => {
  const navigate = useNavigate();
  const correctCount = answers.filter(a => a.correct).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const totalTime = answers.reduce((s, a) => s + a.timeSpent, 0);
  const avgTime = answers.length > 0 ? Math.round(totalTime / answers.length) : 0;

  // Area breakdown
  const areaResults: Record<string, { correct: number; total: number; avgTime: number }> = {};
  for (const a of answers) {
    if (!areaResults[a.topic]) areaResults[a.topic] = { correct: 0, total: 0, avgTime: 0 };
    areaResults[a.topic].total++;
    areaResults[a.topic].avgTime += a.timeSpent;
    if (a.correct) areaResults[a.topic].correct++;
  }
  for (const key of Object.keys(areaResults)) {
    areaResults[key].avgTime = Math.round(areaResults[key].avgTime / areaResults[key].total);
  }

  const sortedAreas = Object.entries(areaResults).sort((a, b) => {
    const pctA = a[1].correct / a[1].total;
    const pctB = b[1].correct / b[1].total;
    return pctB - pctA;
  });

  const weakAreas = sortedAreas.filter(([, v]) => (v.correct / v.total) < 0.6);
  const hasPrevious = Object.keys(previousTopicResults).length > 0;

  const getScoreColor = (pct: number) =>
    pct >= 80 ? "text-green-500" : pct >= 60 ? "text-primary" : pct >= 40 ? "text-warning" : "text-destructive";

  const getScoreLabel = (pct: number) =>
    pct >= 80 ? "Excelente!" : pct >= 60 ? "Bom desempenho" : pct >= 40 ? "Em desenvolvimento" : "Precisa melhorar";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Hero score */}
      <div className="text-center py-6">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10">
          <Award className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Resultado do Nivelamento</h1>
        <div className={cn("text-6xl font-black", getScoreColor(score))}>{score}%</div>
        <p className={cn("text-lg font-semibold mt-1", getScoreColor(score))}>{getScoreLabel(score)}</p>
        <p className="text-muted-foreground text-sm mt-1">
          {correctCount} de {questions.length} questões corretas
        </p>
      </div>

      {/* XP earned */}
      {xpEarned > 0 && (
        <div className="glass-card p-4 flex items-center justify-center gap-3 border-primary/30 bg-primary/5">
          <Zap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold text-primary">+{xpEarned} XP</span>
          <span className="text-sm text-muted-foreground">ganhos neste nivelamento</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <Target className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold">{correctCount}/{questions.length}</div>
          <p className="text-xs text-muted-foreground">Acertos</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold">{avgTime}s</div>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
        </div>
        <div className="glass-card p-4 text-center">
          <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold">{Object.keys(areaResults).length}</div>
          <p className="text-xs text-muted-foreground">Áreas avaliadas</p>
        </div>
      </div>

      {/* Evolution comparison */}
      {hasPrevious && (
        <div className="glass-card p-5 border-primary/20">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Evolução desde o último nivelamento
          </h3>
          <div className="space-y-2">
            {sortedAreas.map(([area, { correct, total }]) => {
              const currentPct = Math.round((correct / total) * 100);
              const prevPct = previousTopicResults[area];
              if (prevPct === undefined) return null;
              const diff = Math.round(currentPct - prevPct);
              if (diff === 0) return null;
              return (
                <div key={area} className="flex items-center justify-between text-sm">
                  <span className="text-foreground/80">{area}</span>
                  <span className={cn("font-semibold flex items-center gap-1",
                    diff > 0 ? "text-green-500" : "text-destructive"
                  )}>
                    {diff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {diff > 0 ? "+" : ""}{diff}%
                  </span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* Area breakdown */}
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Desempenho por área
        </h3>
        <div className="space-y-4">
          {sortedAreas.map(([area, { correct, total, avgTime: areaAvg }]) => {
            const pct = Math.round((correct / total) * 100);
            return (
              <div key={area}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{area}</span>
                  <span className={cn("font-semibold", getScoreColor(pct))}>
                    {correct}/{total} ({pct}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={pct}
                    className={cn("h-2.5 flex-1", pct >= 70 ? "[&>div]:bg-green-500" : pct >= 50 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive")}
                  />
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{areaAvg}s</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak areas CTA */}
      {weakAreas.length > 0 && (
        <div className="glass-card p-5 border-primary/20">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Estude suas áreas fracas com o Tutor IA
          </h3>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map(([area, { correct, total }]) => (
              <Button
                key={area}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate("/dashboard/mentor", {
                  state: {
                    initialMessage: `No nivelamento inicial, tive dificuldade em "${area}" (${Math.round((correct / total) * 100)}% de acerto). Me dê uma aula completa seguindo o protocolo ENAZIZI para reforçar este tema.`,
                    fromErrorBank: true,
                  },
                })}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                {area}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={() => navigate("/dashboard")} className="flex-1">Ir para o Dashboard</Button>
        <Button onClick={() => navigate("/dashboard/plano-dia")} variant="outline" className="flex-1">Ver Plano do Dia</Button>
      </div>
    </div>
  );
};

export default DiagnosticResult;
