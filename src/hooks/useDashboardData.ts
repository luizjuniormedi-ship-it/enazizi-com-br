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

      console.debug("[Dashboard] Initiating Enterprise Unified Hydration...");
      const traceId = crypto.randomUUID();
      const startTime = Date.now();

      try {
        // [PHASE 4] Unified Snapshot via RPC
        const { data: unified, error: unifiedError } = await supabase.rpc('get_unified_dashboard_data', {
          p_user_id: userId,
          p_reset_at: resetAt || "1900-01-01T00:00:00Z",
          p_today_iso: todayIso
        });

        if (unifiedError) throw unifiedError;

        const uni = unified as any;
        const metrics: DashboardMetrics = {
          questionsAnswered: Number(uni.metrics?.total_answered || 0),
          accuracy: Number(uni.metrics?.accuracy || 0),
          errorsCount: cd.errorBankCount,
          pendingRevisoes: Number(uni.metrics?.pending_reviews || 0),
          simuladosCompleted: cd.examSessions?.length || 0,
          discursivasCompleted: 0, // Simplified for MVP
          gamificationStreak: Number(uni.metrics?.streak || 0),
          gamificationXp: cd.gamification?.xp || 0,
          gamificationLevel: cd.gamification?.level || 1,
          globalFlashcards: 0,
          globalQuestions: 0,
          questionsCreated: 0,
          clinicalSimulations: cd.simulationSessionsCount || 0,
          anamnesisCompleted: (cd.anamnesisResults || []).length,
          summariesCreated: 0,
          chroniclesCompleted: 0,
          imageQuizAttempts: 0,
          diagnosticCompleted: 0,
          chatConversations: 0,
          retentionScore: Number(uni.metrics?.avg_retention || 0.5),
          fatigueScore: 0,
          engagementScore: 0,
          overloadThreshold: 0.8,
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
