import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle2, Loader2, BarChart3, RefreshCw, Award, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Prediction {
  approval_probability: number;
  estimated_score: number;
  estimated_ranking_percentile: number;
  trend: string;
  strongest_areas: string[];
  weakest_areas: string[];
  risk_factors: string[];
  recommendations: string[];
  confidence_level: string;
  message: string;
}

const trendIcons = { improving: TrendingUp, declining: TrendingDown, stable: Minus };
const trendColors = { improving: "text-green-500", declining: "text-destructive", stable: "text-warning" };
const trendLabels = { improving: "Em alta", declining: "Em queda", stable: "Estável" };

const PerformancePredictor = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  const predict = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [attemptsRes, profileRes, flashcardsRes, tasksRes, examsRes] = await Promise.all([
        supabase.from("practice_attempts").select("correct, question_id, questions_bank(topic)").eq("user_id", user.id),
        supabase.from("profiles").select("exam_date, daily_study_hours, has_completed_diagnostic").eq("user_id", user.id).maybeSingle(),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        // [planner-unification] Fonte viva: daily_plan_tasks (substitui study_tasks legado)
        supabase.from("daily_plan_tasks").select("completed, created_at").eq("user_id", user.id),
        supabase.from("exam_sessions").select("score, finished_at").eq("user_id", user.id).eq("status", "finished").order("finished_at", { ascending: true }),
      ]);

      const attempts = attemptsRes.data || [];
      const correct = attempts.filter(a => a.correct).length;
      const areaBreakdown: Record<string, { correct: number; total: number }> = {};
      for (const a of attempts) {
        const topic = (a as any).questions_bank?.topic || "Geral";
        if (!areaBreakdown[topic]) areaBreakdown[topic] = { correct: 0, total: 0 };
        areaBreakdown[topic].total++;
        if (a.correct) areaBreakdown[topic].correct++;
      }

      // Calculate streak
      const completedDates = new Set(
        (tasksRes.data || []).filter((t: any) => t.completed).map((t: any) => new Date(t.created_at).toDateString())
      );
      let streak = 0;
      const d = new Date();
      if (!completedDates.has(d.toDateString())) d.setDate(d.getDate() - 1);
      while (completedDates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }

      let daysUntilExam: number | undefined;
      if (profileRes.data?.exam_date) {
        const diff = new Date(profileRes.data.exam_date).getTime() - Date.now();
        if (diff > 0) daysUntilExam = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }

      const response = await supabase.functions.invoke("performance-predictor", {
        body: {
          totalQuestions: attempts.length,
          correctAnswers: correct,
          areaBreakdown,
          studyHoursPerWeek: (profileRes.data?.daily_study_hours || 4) * 5,
          daysUntilExam,
          diagnosticScore: profileRes.data?.has_completed_diagnostic ? "Realizado" : "Não realizado",
          streakDays: streak,
          flashcardsReviewed: flashcardsRes.count || 0,
          simuladoScores: (examsRes.data || []).map((e: any) => e.score),
        },
      });

      if (response.error) throw response.error;
      setPrediction(response.data);
    } catch (err: any) {
      toast({ title: "Erro na previsão", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { predict(); }, [user]);

  const TrendIcon = prediction ? (trendIcons as any)[prediction.trend] || Minus : Minus;
  const trendColor = prediction ? (trendColors as any)[prediction.trend] || "text-muted-foreground" : "";
  const trendLabel = prediction ? (trendLabels as any)[prediction.trend] || "Sem dados" : "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Previsão de Desempenho
          </h1>
          <p className="text-muted-foreground">Análise preditiva da sua preparação para residência.</p>
        </div>
        <Button onClick={predict} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="ml-3 text-muted-foreground">Analisando seu desempenho...</span>
        </div>
      )}

      {prediction && !loading && (
        <>
          {/* Main metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-6 text-center">
              <Target className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-4xl font-black text-primary">{Math.round(prediction.approval_probability * 100)}%</div>
              <div className="text-sm text-muted-foreground">Probabilidade de aprovação</div>
              <div className="text-xs text-muted-foreground mt-1">Confiança: {prediction.confidence_level}</div>
            </div>
            <div className="glass-card p-6 text-center">
              <Award className="h-8 w-8 text-accent mx-auto mb-2" />
              <div className="text-4xl font-black">{Math.round(prediction.estimated_score)}</div>
              <div className="text-sm text-muted-foreground">Nota estimada</div>
            </div>
            <div className="glass-card p-6 text-center">
              <TrendIcon className={`h-8 w-8 ${trendColor} mx-auto mb-2`} />
              <div className={`text-2xl font-bold ${trendColor}`}>{trendLabel}</div>
              <div className="text-sm text-muted-foreground">Tendência</div>
              <div className="text-xs text-muted-foreground mt-1">Top {prediction.estimated_ranking_percentile}%</div>
            </div>
          </div>

          {/* Message */}
          <div className="glass-card p-5">
            <p className="text-sm leading-relaxed">{prediction.message}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strongest areas */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Áreas mais fortes
              </h3>
              <div className="space-y-2">
                {prediction.strongest_areas.map(area => (
                  <div key={area} className="flex items-center gap-2 p-2 rounded bg-green-500/10">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{area}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Weakest areas */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Áreas para melhorar
              </h3>
              <div className="space-y-2">
                {prediction.weakest_areas.map(area => (
                  <div key={area} className="flex items-center gap-2 p-2 rounded bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">{area}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk factors */}
          {prediction.risk_factors.length > 0 && (
            <div className="glass-card p-5 border-warning/30">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Fatores de risco
              </h3>
              <ul className="space-y-1">
                {prediction.risk_factors.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-warning">⚠️</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Recomendações
            </h3>
            <ul className="space-y-2">
              {prediction.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">→</span> {r}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {!prediction && !loading && (
        <div className="text-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Responda questões e faça simulados para receber sua previsão.</p>
        </div>
      )}
    </div>
  );
};

export default PerformancePredictor;
