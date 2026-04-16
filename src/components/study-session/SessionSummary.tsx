import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, CheckCircle2, XCircle, BookOpen, Sparkles, ArrowRight, TrendingUp, Target } from "lucide-react";
import type { StudySessionSummary } from "@/hooks/useStudySession";

function fmtDuration(s: number) {
  if (s < 60) return `${s} segundos`;
  const m = Math.floor(s / 60);
  return `${m} ${m === 1 ? "minuto" : "minutos"}`;
}

const MOTIVATIONAL = [
  "Cada sessão conta. Você está construindo conhecimento real! 💪",
  "Consistência é o segredo. Continue assim! 🔥",
  "Seu futuro eu agradece por cada minuto investido. 🎯",
  "Estudo focado é o caminho mais rápido para a aprovação! 🚀",
];

interface Props {
  summary: StudySessionSummary;
  onContinue: () => void;
  onDismiss: () => void;
}

function getPerformanceGrade(accuracy: number) {
  if (accuracy >= 90) return { label: "Excelente!", color: "text-green-500", icon: "🌟" };
  if (accuracy >= 70) return { label: "Muito Bom!", color: "text-primary", icon: "💪" };
  if (accuracy >= 50) return { label: "Bom progresso", color: "text-warning", icon: "📈" };
  return { label: "Continue praticando", color: "text-muted-foreground", icon: "🎯" };
}

function getNextStepSuggestion(summary: StudySessionSummary) {
  const accuracy = summary.tasksCompleted > 0
    ? (summary.correctAnswers / summary.tasksCompleted) * 100
    : 0;

  if (accuracy < 50) {
    return { text: "Revise os temas fracos no Caderno de Erros", icon: <Target className="h-4 w-4" /> };
  }
  if (accuracy < 70) {
    return { text: "Pratique mais questões nos temas estudados", icon: <BookOpen className="h-4 w-4" /> };
  }
  if (summary.durationSeconds < 600) {
    return { text: "Tente uma sessão mais longa para consolidar", icon: <Clock className="h-4 w-4" /> };
  }
  return { text: "Avance para novos temas no Plano do Dia", icon: <TrendingUp className="h-4 w-4" /> };
}

export default function SessionSummary({ summary, onContinue, onDismiss }: Props) {
  const msg = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  const accuracy = summary.tasksCompleted > 0
    ? Math.round((summary.correctAnswers / summary.tasksCompleted) * 100)
    : 0;
  const grade = getPerformanceGrade(accuracy);
  const nextStep = getNextStepSuggestion(summary);

  return (
    <div className="animate-slide-up">
      <Card className="border-primary/30 overflow-hidden">
        <div className="h-1" style={{ background: "var(--gradient-primary)" }} />
        <CardContent className="p-5 sm:p-7 space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center animate-score-pop">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Sessão concluída!</h2>
            <p className="text-sm text-muted-foreground">{msg}</p>
          </div>

          {/* Performance grade */}
          <div className="text-center">
            <span className="text-3xl">{grade.icon}</span>
            <p className={`text-sm font-semibold mt-1 ${grade.color}`}>{grade.label}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCell icon={<Clock className="h-4 w-4 text-primary" />} label="Tempo" value={fmtDuration(summary.durationSeconds)} />
            <StatCell icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} label="Acertos" value={String(summary.correctAnswers)} />
            <StatCell icon={<XCircle className="h-4 w-4 text-destructive" />} label="Erros" value={String(summary.wrongAnswers)} />
            <StatCell icon={<Sparkles className="h-4 w-4 text-primary" />} label="Precisão" value={`${accuracy}%`} />
          </div>

          {/* Themes touched */}
          {summary.themesTouched.length > 0 && (
            <div className="space-y-1.5 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> Temas trabalhados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.themesTouched.slice(0, 6).map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {t}
                  </span>
                ))}
                {summary.themesTouched.length > 6 && (
                  <span className="text-xs text-muted-foreground">+{summary.themesTouched.length - 6}</span>
                )}
              </div>
            </div>
          )}

          {/* Next step suggestion */}
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 flex items-center gap-2 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            {nextStep.icon}
            <p className="text-xs text-primary font-medium flex-1">
              💡 Próximo passo: {nextStep.text}
            </p>
            <ArrowRight className="h-3.5 w-3.5 text-primary/60" />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" className="flex-1 gap-2 font-semibold" onClick={onContinue}>
              🚀 Continuar estudando
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={onDismiss}>
              Encerrar por agora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/50">
      {icon}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-base font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
