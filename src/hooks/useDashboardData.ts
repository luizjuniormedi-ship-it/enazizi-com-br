import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { saveDashboardSnapshot, loadDashboardSnapshot } from "@/lib/dashboardSnapshot";
import { useFeatureFlags } from "./useFeatureFlags";

export interface DashboardStats {
  flashcards: number;
  uploads: number;
  completedTasks: number;
  totalTasks: number;
  totalStudyHours: number;
  subjects: string[];
  subjectHours: Record<string, number>;
  upcomingReviews: { topic: string; next: string }[];
  daysUntilExam: number | null;
  weeklyChart: { week: string; hours: number; timestamp: number }[];
  streak: number;
  todayCompleted: number;
  todayTotal: number;
  questionsToday: number;
  hasStudyPlan: boolean;
}

export interface DashboardMetrics {
  questionsAnswered: number;
  accuracy: number;
  errorsCount: number;
  pendingRevisoes: number;
  simuladosCompleted: number;
  discursivasCompleted: number;
  gamificationStreak: number;
  gamificationXp: number;
  gamificationLevel: number;
  globalFlashcards: number;
  globalQuestions: number;
  questionsCreated: number;
  clinicalSimulations: number;
  anamnesisCompleted: number;
  summariesCreated: number;
  chroniclesCompleted: number;
  imageQuizAttempts: number;
  diagnosticCompleted: number;
  chatConversations: number;
  // Fase Enterprise+ (Neuroanalytics)
  retentionScore?: number;
  fatigueScore?: number;
  engagementScore?: number;
  overloadThreshold?: number;
}

// [planner-unification-final] PlanJson removido — Dashboard não lê mais study_plans.
// hasStudyPlan, subjects, subjectHours, totalStudyHours, todayTotal são derivados de daily_plans/daily_plan_tasks.
// daysUntilExam é derivado de profiles.exam_date (via coreData).

export const useDashboardData = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const { isEnabled } = useFeatureFlags();
  const snapshotEnabled = isEnabled("new_dashboard_snapshot_enabled");
  const resetAt = coreData?.profile.last_study_plan_reset_at ?? null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Load snapshot as placeholder data to allow "Instant Dashboard"
  const { data: snapshot } = useQuery({
    queryKey: ["dashboard-snapshot", user?.id],
    queryFn: () => user ? loadDashboardSnapshot(user.id) : null,
    enabled: !!user && snapshotEnabled,
    staleTime: 1000 * 60 * 10, // 10 mins
  });

  return useQuery({
    queryKey: ["dashboard-data", user?.id, !!coreData, resetAt],
    placeholderData: snapshot || undefined,
    queryFn: async () => {
      const userId = user!.id;
      const cd = coreData!;

      console.debug("[Dashboard] Initiating Enterprise Hydration...");
      const traceId = crypto.randomUUID();
      const startTime = Date.now();

      try {
        // Only queries NOT covered by coreData
        // [planner-unification-final] study_plans removido das leituras críticas do Dashboard.
        const [
          flashcardsRes, uploadsRes, tasksRes, dailyPlansRes, reviewsRes,
          discursivasRes, globalFlashRes, globalQuestRes,
          questionsCreatedRes, summariesRes, chroniclesRes,
          imageQuizRes, diagnosticRes,
          adaptiveProfileRes,
        ] = await Promise.all([
          supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", userId),
          // [planner-unification] Fonte viva: daily_plan_tasks. specialty/topic + estimated_minutes alimentam subjects/subjectHours.
          // Permite ver tarefas de hoje mesmo se o plano foi resetado hoje.
          supabase.from("daily_plan_tasks").select("completed, created_at, completed_at, estimated_minutes, specialty, topic, daily_plan_id")
            .eq("user_id", userId)
            .or(`created_at.gt.${resetAt || "1900-01-01T00:00:00Z"},created_at.gte.${todayIso}`),
          // [planner-unification-final] Fonte viva: daily_plans. Detecta presença de plano ativo nos últimos 7 dias.
          supabase.from("daily_plans").select("id, plan_date, total_blocks, created_at, updated_at")
            .eq("user_id", userId)
            .gte("plan_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0])
            .or(`updated_at.gt.${resetAt || "1900-01-01T00:00:00Z"},updated_at.gte.${todayIso}`)
            .order("plan_date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("reviews").select("next_review, flashcard_id, flashcards(topic)").eq("user_id", userId).gte("next_review", new Date().toISOString()).order("next_review", { ascending: true }).limit(5),
          supabase.from("discursive_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).not("finished_at", "is", null),
          supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("is_global", true),
          supabase.from("questions_bank").select("id", { count: "exact", head: true }).eq("is_global", true).eq("review_status", "approved"),
          supabase.from("questions_bank").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("summaries").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("chat_conversations").select("id, agent_type", { count: "exact" }).eq("user_id", userId),
          supabase.from("medical_image_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("diagnostic_results").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("cme_adaptive_profiles").select("*").eq("user_id", userId).maybeSingle(),
        ]);

        const [teacherSimuladoRes, teacherClinicalRes] = await Promise.all([
          supabase.from("teacher_simulado_results").select("total_questions, score").eq("student_id", userId),
          supabase.from("teacher_clinical_case_results").select("id", { count: "exact", head: true }).eq("student_id", userId),
        ]);

        // Use coreData for shared data
        const practiceAttempts = cd.practiceAttempts || [];
        const todayStr = new Date().toISOString().split("T")[0];
        const questionsToday = practiceAttempts.filter(a => a.created_at?.startsWith(todayStr)).length;
        const practiceCorrect = practiceAttempts.filter(a => a.correct).length;
        const practiceTotal = practiceAttempts.length;

        const examData = cd.examSessions || [];
        const examQuestionsTotal = examData.reduce((sum, e) => sum + (e.total_questions || 0), 0);
        const examCorrectTotal = examData.reduce((sum, e) => {
          const total = e.total_questions || 0;
          return sum + Math.round(((e.score || 0) / 100) * total);
        }, 0);

        const teacherSimData = teacherSimuladoRes.data || [];
        const teacherQuestionsTotal = teacherSimData.reduce((sum: number, e: any) => sum + (e.total_questions || 0), 0);
        const teacherCorrectTotal = teacherSimData.reduce((sum: number, e: any) => {
          const total = e.total_questions || 0;
          return sum + Math.round(((e.score || 0) / 100) * total);
        }, 0);

        const teacherClinicalCount = teacherClinicalRes.count || 0;
        const questionsAnswered = practiceTotal + examQuestionsTotal + teacherQuestionsTotal;
        const totalCorrect = practiceCorrect + examCorrectTotal + teacherCorrectTotal;
        const accuracy = questionsAnswered > 0 ? Math.min(Math.round((totalCorrect / questionsAnswered) * 100), 100) : 0;

        const pendingRevisoes = (cd.revisoes || []).filter(r => {
          if (r.status !== "pendente") return false;
          return r.data_revisao <= todayStr;
        }).length;

        const totalSimulados = examData.length + teacherSimData.length;
        const totalClinical = cd.simulationSessionsCount + teacherClinicalCount;
        const gamData = cd.gamification;

        const metrics: DashboardMetrics = {
          questionsAnswered,
          accuracy,
          errorsCount: cd.errorBankCount,
          pendingRevisoes,
          simuladosCompleted: totalSimulados,
          discursivasCompleted: discursivasRes.count || 0,
          gamificationStreak: gamData?.current_streak || 0,
          gamificationXp: gamData?.xp || 0,
          gamificationLevel: gamData?.level || 1,
          globalFlashcards: globalFlashRes.count || 0,
          globalQuestions: globalQuestRes.count || 0,
          questionsCreated: questionsCreatedRes.count || 0,
          clinicalSimulations: totalClinical,
          anamnesisCompleted: (cd.anamnesisResults || []).length,
          summariesCreated: summariesRes.count || 0,
          chroniclesCompleted: (chroniclesRes.data || []).filter((c: any) => c.agent_type === "medical-chronicle").length,
          imageQuizAttempts: imageQuizRes.count || 0,
          diagnosticCompleted: diagnosticRes.count || 0,
          chatConversations: chroniclesRes.count || 0,
          retentionScore: Number(adaptiveProfileRes.data?.retention_score) || 0,
          fatigueScore: 0, // Will be updated by real-time neuroanalytics
          engagementScore: 0,
          overloadThreshold: Number(adaptiveProfileRes.data?.overload_threshold) || 0.8,
        };

        // Build stats
        const tasks = tasksRes.data || [];
        const completedTasks = tasks.filter((t: any) => t.completed).length;

        const weekMap: Record<string, { hours: number; timestamp: number }> = {};
        for (const task of tasks) {
          if (!(task as any).completed) continue;
          // [planner-unification] usar completed_at quando existir; fallback para created_at
          const refDate = (task as any).completed_at || (task as any).created_at;
          const date = new Date(refDate);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const key = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
          // [planner-unification] estimated_minutes substitui task_json.duration
          const minutes = (task as any).estimated_minutes ?? 60;
          const hours = minutes / 60;
          if (!weekMap[key]) weekMap[key] = { hours: 0, timestamp: weekStart.getTime() };
          weekMap[key].hours += hours;
        }
        const weeklyChart = Object.entries(weekMap)
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .map(([week, { hours, timestamp }]) => ({ week, hours: Math.round(hours * 10) / 10, timestamp }));

        // [planner-unification-final] hasStudyPlan agora vem de daily_plans (fonte viva).
        const hasStudyPlan = !!dailyPlansRes.data;

        // [planner-unification-final] subjects + subjectHours derivados de daily_plan_tasks (specialty/topic + estimated_minutes).
        const subjectHours: Record<string, number> = {};
        let totalStudyHours = 0;
        for (const t of tasks as any[]) {
          const subject = (t.specialty || t.topic || "").toString().trim();
          if (!subject) continue;
          const hours = ((t.estimated_minutes ?? 60) as number) / 60;
          subjectHours[subject] = (subjectHours[subject] || 0) + hours;
          totalStudyHours += hours;
        }
        const subjects = Object.keys(subjectHours);

        // [planner-unification-final] daysUntilExam vem de profiles.exam_date (coreData).
        let daysUntilExam: number | null = null;
        const examDateVal = cd.profile?.exam_date;
        if (examDateVal) {
          const diff = new Date(examDateVal).getTime() - Date.now();
          if (diff > 0) daysUntilExam = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        const upcomingReviews = (reviewsRes.data || []).map((r: any) => ({
          topic: r.flashcards?.topic || "Sem tópico",
          next: r.next_review,
        }));

        // [planner-unification-final] todayTotal/todayCompleted vêm de daily_plan_tasks do plano de hoje.
        const todayPlanId = dailyPlansRes.data?.plan_date === new Date().toISOString().split("T")[0]
          ? dailyPlansRes.data.id
          : null;
        const todayTasks = todayPlanId
          ? (tasks as any[]).filter((t) => t.daily_plan_id === todayPlanId)
          : [];
        const todayTotal = todayTasks.length || (dailyPlansRes.data?.total_blocks ?? 0);
        const completedToday = todayTasks.filter((t: any) => t.completed);

        const stats: DashboardStats = {
          flashcards: flashcardsRes.count || 0,
          uploads: uploadsRes.count || 0,
          completedTasks,
          totalTasks: tasks.length,
          totalStudyHours,
          subjects,
          subjectHours,
          upcomingReviews,
          daysUntilExam,
          weeklyChart,
          streak: gamData?.current_streak || 0,
          todayCompleted: completedToday.length,
          todayTotal,
          questionsToday,
          hasStudyPlan,
        };

        const result = {
          stats,
          metrics,
          displayName: cd.profile?.display_name,
          hasCompletedDiagnostic: cd.profile?.has_completed_diagnostic,
          targetExams: cd.profile?.target_exams,
        };

        // Write-through: persist snapshot for next fast-path
        saveDashboardSnapshot(userId, result);
        console.debug(`[Dashboard] Hydration complete in ${Date.now() - startTime}ms`, { traceId });

        return result;
      } catch (err: any) {
        console.warn("[Dashboard] fetchDashboardData falhou:", err?.message || err);
        const emptyStats: DashboardStats = {
          flashcards: 0, uploads: 0, completedTasks: 0, totalTasks: 0,
          totalStudyHours: 0, subjects: [], subjectHours: {},
          upcomingReviews: [], daysUntilExam: null, weeklyChart: [],
          streak: 0, todayCompleted: 0, todayTotal: 0, questionsToday: 0, hasStudyPlan: false,
        };
        const emptyMetrics: DashboardMetrics = {
          questionsAnswered: 0, accuracy: 0, errorsCount: 0, pendingRevisoes: 0,
          simuladosCompleted: 0, discursivasCompleted: 0,
          gamificationStreak: 0, gamificationXp: 0, gamificationLevel: 1,
          globalFlashcards: 0, globalQuestions: 0, questionsCreated: 0,
          clinicalSimulations: 0, anamnesisCompleted: 0, summariesCreated: 0,
          chroniclesCompleted: 0, imageQuizAttempts: 0, diagnosticCompleted: 0, chatConversations: 0,
        };
        return { stats: emptyStats, metrics: emptyMetrics, displayName: null, hasCompletedDiagnostic: false, targetExams: [] as string[] };
      }
    },
    enabled: !!user && !!coreData,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
