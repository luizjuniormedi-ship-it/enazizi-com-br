import { useEffect } from "react";
import { BarChart3, TrendingUp, Target, Clock, BookOpen, CheckCircle2, Loader2, HelpCircle, Stethoscope, Award, MoreVertical, Brain, Heart, PenLine, MessageCircle, ImageIcon, Activity } from "lucide-react";
import { CinematicHero } from "@/components/cinematic";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import { useQuery } from "@tanstack/react-query";
import ModuleHelpButton from "@/components/layout/ModuleHelpButton";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PerformanceReport from "@/components/dashboard/PerformanceReport";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ActivityHeatmap from "@/components/analytics/ActivityHeatmap";
import AccuracyTrendChart from "@/components/analytics/AccuracyTrendChart";
import SpecialtyRadarChart from "@/components/analytics/SpecialtyRadarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface AnalyticsData {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  totalSessions: number;
  totalFlashcards: number;
  totalUploads: number;
  completedTasks: number;
  totalTasks: number;
  topicBreakdown: { topic: string; correct: number; total: number; rate: number }[];
  weeklyActivity: { day: string; tasks: number }[];
  examScores: { title: string; score: number; date: string }[];
  activityDates: string[];
  weeklyAccuracy: { week: string; accuracy: number; total: number }[];
  radarData: { specialty: string; score: number }[];
  // New module data
  clinicalSimulations: { total: number; avgScore: number; diagnosisRate: number };
  anamnesisResults: { total: number; avgScore: number; avgGrade: string };
  discursiveResults: { total: number; avgScore: number };
  chroniclesCount: number;
  imageQuizResults: { total: number; accuracy: number };
  chatConversations: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

async function fetchAnalyticsData(userId: string): Promise<AnalyticsData> {
  const [
    attemptsRes, flashcardsRes, uploadsRes, tasksRes, examsRes, perfRes,
    simHistoryRes, anamnesisRes, discursiveRes, chroniclesRes, imageQuizRes, chatConvRes,
    teacherSimRes, teacherClinicalRes,
  ] = await Promise.all([
    supabase.from("practice_attempts").select("correct, created_at, question_id, questions_bank(topic)").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    // [planner-unification] Fonte viva: daily_plan_tasks (substitui study_tasks legado)
    supabase.from("daily_plan_tasks").select("completed, created_at").eq("user_id", userId),
    supabase.from("exam_sessions").select("title, score, finished_at, total_questions").eq("user_id", userId).eq("status", "finished").order("finished_at", { ascending: false }).limit(10),
    supabase.from("study_performance").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("simulation_history").select("final_score, student_got_diagnosis, grade").eq("user_id", userId),
    supabase.from("anamnesis_results").select("final_score, grade").eq("user_id", userId),
    supabase.from("discursive_attempts").select("score, max_score").eq("user_id", userId).not("finished_at", "is", null),
    supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("agent_type", "medical-chronicle"),
    supabase.from("medical_image_attempts").select("correct").eq("user_id", userId),
    supabase.from("chat_conversations").select("id", { count: "exact", head: true }).eq("user_id", userId),
    // Additional sources to match Dashboard
    supabase.from("teacher_simulado_results").select("total_questions, score, finished_at").eq("student_id", userId),
    supabase.from("teacher_clinical_case_results").select("id", { count: "exact", head: true }).eq("student_id", userId),
  ]);

  const attempts = attemptsRes.data || [];
  const practiceCorrect = attempts.filter(a => a.correct).length;
  const practiceTotal = attempts.length;
  const tasks = tasksRes.data || [];
  const completedTasks = tasks.filter(t => t.completed).length;

  // Unified accuracy: practice_attempts + exam_sessions + teacher_simulado_results (same as Dashboard)
  const examData = examsRes.data || [];
  const examQuestionsTotal = examData.reduce((sum, e: any) => sum + (e.total_questions || 0), 0);
  const examCorrectTotal = examData.reduce((sum, e: any) => {
    const total = e.total_questions || 0;
    return sum + Math.round(((e.score || 0) / 100) * total);
  }, 0);

  const teacherSimData = teacherSimRes.data || [];
  const teacherQuestionsTotal = teacherSimData.reduce((sum, e: any) => sum + (e.total_questions || 0), 0);
  const teacherCorrectTotal = teacherSimData.reduce((sum, e: any) => {
    const total = e.total_questions || 0;
    return sum + Math.round(((e.score || 0) / 100) * total);
  }, 0);

  const totalQuestions = practiceTotal + examQuestionsTotal + teacherQuestionsTotal;
  const totalCorrect = practiceCorrect + examCorrectTotal + teacherCorrectTotal;
  const accuracy = totalQuestions > 0 ? Math.min(Math.round((totalCorrect / totalQuestions) * 100), 100) : 0;

  // Topic breakdown (practice_attempts only — has topic detail)
  const topicMap: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    const topic = (a as any).questions_bank?.topic || "Geral";
    if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 };
    topicMap[topic].total++;
    if (a.correct) topicMap[topic].correct++;
  }
  const topicBreakdown = Object.entries(topicMap)
    .map(([topic, v]) => ({ topic, ...v, rate: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // Weekly activity
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const weeklyActivity = days.map(day => ({ day, tasks: 0 }));
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  for (const t of tasks) {
    if (!t.completed) continue;
    const d = new Date(t.created_at);
    if (d >= weekAgo) weeklyActivity[d.getDay()].tasks++;
  }

  // Activity dates for heatmap
  const activityDateSet = new Set<string>();
  for (const a of attempts) {
    activityDateSet.add(new Date((a as any).created_at).toISOString().split("T")[0]);
  }
  for (const t of tasks) {
    if (t.completed) activityDateSet.add(new Date(t.created_at).toISOString().split("T")[0]);
  }
  const activityDates = Array.from(activityDateSet);

  // Weekly accuracy trend
  const weekMap: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    const d = new Date((a as any).created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
    if (!weekMap[key]) weekMap[key] = { correct: 0, total: 0 };
    weekMap[key].total++;
    if (a.correct) weekMap[key].correct++;
  }
  const weeklyAccuracy = Object.entries(weekMap)
    .map(([week, v]) => ({ week, accuracy: Math.round((v.correct / v.total) * 100), total: v.total }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);

  const radarData = topicBreakdown.slice(0, 8).map(t => ({ specialty: t.topic, score: t.rate }));

  // Exam scores: own simulados + teacher simulados
  const examScores = (examData).map((e: any) => ({
    title: e.title || "Simulado",
    score: Number(e.score) || 0,
    date: e.finished_at ? new Date(e.finished_at).toLocaleDateString("pt-BR") : "",
  }));
  for (const ts of teacherSimData) {
    if ((ts as any).finished_at) {
      examScores.push({
        title: "Simulado do Professor",
        score: Number((ts as any).score) || 0,
        date: new Date((ts as any).finished_at).toLocaleDateString("pt-BR"),
      });
    }
  }

  const sessionCount = perfRes.data ? ((perfRes.data.historico_estudo as any[]) || []).length : 0;

  // Clinical simulations (own + teacher)
  const simHistory = simHistoryRes.data || [];
  const totalClinicalCount = simHistory.length + (teacherClinicalRes.count || 0);
  const simAvgScore = simHistory.length > 0 ? Math.round(simHistory.reduce((s, h) => s + (h.final_score || 0), 0) / simHistory.length) : 0;
  const simDiagRate = simHistory.length > 0 ? Math.round((simHistory.filter(h => h.student_got_diagnosis).length / simHistory.length) * 100) : 0;

  // Anamnesis
  const anamnesisData = anamnesisRes.data || [];
  const anamTotal = anamnesisData.length;
  const anamAvgScore = anamTotal > 0 ? Math.round(anamnesisData.reduce((s, a) => s + (a.final_score || 0), 0) / anamTotal) : 0;
  const gradeOrder = ["A+", "A", "B", "C", "D", "F"];
  const anamAvgGrade = anamTotal > 0
    ? (anamnesisData.map(a => a.grade || "F").sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[Math.floor(anamTotal / 2)] || "F")
    : "-";

  // Discursive
  const discursiveData = discursiveRes.data || [];
  const discTotal = discursiveData.length;
  const discAvgScore = discTotal > 0
    ? Math.round(discursiveData.reduce((s, d) => s + (Number(d.score) || 0), 0) / discTotal * 10) / 10
    : 0;

  // Image quiz
  const imageAttempts = imageQuizRes.data || [];
  const imageTotal = imageAttempts.length;
  const imageCorrect = imageAttempts.filter(a => a.correct).length;
  const imageAccuracy = imageTotal > 0 ? Math.round((imageCorrect / imageTotal) * 100) : 0;

  return {
    totalQuestions,
    correctAnswers: totalCorrect,
    accuracy,
    totalSessions: sessionCount,
    totalFlashcards: flashcardsRes.count || 0,
    totalUploads: uploadsRes.count || 0,
    completedTasks,
    totalTasks: tasks.length,
    topicBreakdown,
    weeklyActivity,
    examScores,
    activityDates,
    weeklyAccuracy,
    radarData,
    clinicalSimulations: { total: totalClinicalCount, avgScore: simAvgScore, diagnosisRate: simDiagRate },
    anamnesisResults: { total: anamTotal, avgScore: anamAvgScore, avgGrade: anamAvgGrade },
    discursiveResults: { total: discTotal, avgScore: discAvgScore },
    chroniclesCount: chroniclesRes.count || 0,
    imageQuizResults: { total: imageTotal, accuracy: imageAccuracy },
    chatConversations: chatConvRes.count || 0,
  };
}

const Analytics = () => {
  const { user } = useAuth();
  useEffect(() => { telemetry.track('analytics_opened'); }, []);
  const { data, isLoading: loading } = useQuery({
    queryKey: ["analytics-data", user?.id],
    queryFn: () => fetchAnalyticsData(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in p-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse h-24" />
          ))}
        </div>
        <div className="rounded-xl bg-muted animate-pulse h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-muted animate-pulse h-56" />
          <div className="rounded-xl bg-muted animate-pulse h-56" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <BarChart3 className="h-12 w-12 opacity-30" />
        <p className="text-sm">Nenhum dado de analytics disponível ainda.</p>
        <p className="text-xs">Complete algumas sessões de estudo para ver seu progresso aqui.</p>
      </div>
    );
  }

  const maxTasks = Math.max(...data.weeklyActivity.map(d => d.tasks), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <CinematicHero
        module="analytics"
        eyebrow={<><Activity className="h-3.5 w-3.5" /> Inteligência estratégica</>}
        title="Analytics"
        subtitle="Seu desempenho real, traduzido em mapas mentais, tendências e radares — para decisões cirúrgicas no seu estudo."
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><div><PerformanceReport /></div></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {}}>
                  <HelpCircle className="h-4 w-4 mr-2" /> Como usar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        media={
          <div className="hidden lg:flex h-24 w-24 items-center justify-center rounded-2xl glass-premium-strong glow-module">
            <BarChart3 className="h-10 w-10 text-module" />
          </div>
        }
      />

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <HelpCircle className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold">{data.totalQuestions}</div>
          <div className="text-xs text-muted-foreground">Questões respondidas</div>
        </div>
        <div className="glass-card p-4">
          <Target className="h-5 w-5 text-emerald-500 mb-2" />
          <div className="text-2xl font-bold">{data.accuracy}%</div>
          <div className="text-xs text-muted-foreground">Taxa de acerto</div>
        </div>
        <div className="glass-card p-4">
          <BookOpen className="h-5 w-5 text-violet-500 mb-2" />
          <div className="text-2xl font-bold">{data.totalSessions}</div>
          <div className="text-xs text-muted-foreground">Sessões de estudo</div>
        </div>
        <div className="glass-card p-4">
          <CheckCircle2 className="h-5 w-5 text-amber-500 mb-2" />
          <div className="text-2xl font-bold">{data.completedTasks}/{data.totalTasks}</div>
          <div className="text-xs text-muted-foreground">Tarefas concluídas</div>
        </div>
      </div>

      {/* Module Performance Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Desempenho por Módulo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Clinical Simulation */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-teal-500" />
                <span className="text-sm font-medium">Simulação Clínica</span>
              </div>
              {data.clinicalSimulations.total > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{data.clinicalSimulations.total} simulações</span>
                    <span>Nota média: {data.clinicalSimulations.avgScore}/100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.clinicalSimulations.diagnosisRate} className="h-2 flex-1" />
                    <span className="text-xs font-medium">{data.clinicalSimulations.diagnosisRate}% diagnósticos corretos</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma simulação realizada</p>
              )}
            </div>

            {/* Anamnesis */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" />
                <span className="text-sm font-medium">Treino de Anamnese</span>
              </div>
              {data.anamnesisResults.total > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{data.anamnesisResults.total} treinos</span>
                    <span>Nota média: {data.anamnesisResults.avgScore}/100</span>
                  </div>
                  <div className="text-xs">
                    Conceito médio: <span className="font-bold text-primary">{data.anamnesisResults.avgGrade}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum treino realizado</p>
              )}
            </div>

            {/* Discursive */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium">Questões Discursivas</span>
              </div>
              {data.discursiveResults.total > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{data.discursiveResults.total} questões</span>
                    <span>Nota média: {data.discursiveResults.avgScore}/10</span>
                  </div>
                  <Progress value={data.discursiveResults.avgScore * 10} className="h-2" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma questão respondida</p>
              )}
            </div>

            {/* Image Quiz */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium">Questões com Imagem</span>
              </div>
              {data.imageQuizResults.total > 0 ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{data.imageQuizResults.total} tentativas</span>
                    <span>Acerto: {data.imageQuizResults.accuracy}%</span>
                  </div>
                  <Progress value={data.imageQuizResults.accuracy} className="h-2" />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma tentativa realizada</p>
              )}
            </div>

            {/* Chronicles */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Crônicas Médicas</span>
              </div>
              <div className="text-2xl font-bold">{data.chroniclesCount}</div>
              <p className="text-xs text-muted-foreground">crônicas estudadas</p>
            </div>

            {/* AI Conversations */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Conversas com IA</span>
              </div>
              <div className="text-2xl font-bold">{data.chatConversations}</div>
              <p className="text-xs text-muted-foreground">conversas totais</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <ActivityHeatmap dates={data.activityDates} />

      {/* Accuracy Trend + Radar side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccuracyTrendChart data={data.weeklyAccuracy} />
        <SpecialtyRadarChart data={data.radarData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Atividade semanal</h2>
          {data.weeklyActivity.every(d => d.tasks === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade na última semana.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {data.weeklyActivity.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.tasks}</span>
                  <div
                    className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary min-h-[4px]"
                    style={{ height: `${(d.tasks / maxTasks) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topic Breakdown */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Desempenho por especialidade</h2>
          {data.topicBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Responda questões para ver seu desempenho por área.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {data.topicBreakdown.slice(0, 10).map((t, i) => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 truncate">{t.topic}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${t.rate}%`, backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-12 text-right ${t.rate >= 70 ? "text-emerald-500" : t.rate >= 50 ? "text-amber-500" : "text-destructive"}`}>
                    {t.rate}%
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{t.total}Q</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exam Scores */}
      {data.examScores.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Simulados realizados
          </h2>
          <div className="space-y-2">
            {data.examScores.map((e, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <span className="text-sm font-medium">{e.title}</span>
                  <span className="text-xs text-muted-foreground ml-2">{e.date}</span>
                </div>
                <span className={`text-sm font-bold ${e.score >= 70 ? "text-emerald-500" : e.score >= 50 ? "text-amber-500" : "text-destructive"}`}>
                  {e.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <Stethoscope className="h-5 w-5 text-primary mx-auto mb-2" />
          <div className="text-lg font-bold">{data.totalFlashcards}</div>
          <div className="text-xs text-muted-foreground">Flashcards criados</div>
        </div>
        <div className="glass-card p-4 text-center">
          <BookOpen className="h-5 w-5 text-primary mx-auto mb-2" />
          <div className="text-lg font-bold">{data.totalUploads}</div>
          <div className="text-xs text-muted-foreground">Materiais enviados</div>
        </div>
        <div className="glass-card p-4 text-center">
          <TrendingUp className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-lg font-bold">{data.examScores.length}</div>
          <div className="text-xs text-muted-foreground">Simulados completos</div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
