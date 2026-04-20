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
}

interface PlanJson {
  weeklySchedule?: { day: string; tasks: { time: string; subject: string; duration: string; type?: string }[] }[];
  subjects?: string[];
  tips?: string;
  config?: { examDate: string; hoursPerDay: number; daysPerWeek: number };
}

export const useDashboardData = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const { isEnabled } = useFeatureFlags();
  const snapshotEnabled = isEnabled("new_dashboard_snapshot_enabled");

  return useQuery({
    queryKey: ["dashboard-data", user?.id, !!coreData],
    queryFn: async () => {
      const userId = user!.id;
      const cd = coreData!;

      // Fast-path: try snapshot first (only if flag enabled)
      if (snapshotEnabled) {
        const snapshot = await loadDashboardSnapshot(userId);
        if (snapshot) {
          console.debug("[Dashboard] Using snapshot (fast-path)");
          return snapshot;
        }
      }

      console.debug("[Dashboard] Full query path");

      try {
        // Only queries NOT covered by coreData
        const [
          flashcardsRes, uploadsRes, tasksRes, plansRes, reviewsRes,
          discursivasRes, globalFlashRes, globalQuestRes,
          questionsCreatedRes, summariesRes, chroniclesRes,
          imageQuizRes, diagnosticRes,
        ] = await Promise.all([
          supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", userId),
          // [planner-unification] Fonte viva: daily_plan_tasks (substitui study_tasks legado).
          // estimated_minutes substitui task_json.duration; completed_at substitui filtro por created_at.
          supabase.from("daily_plan_tasks").select("completed, created_at, completed_at, estimated_minutes").eq("user_id", userId),
          // @legacy-read — study_plans.plan_json contém weeklySchedule semanal sem equivalente em daily_plans (que é diário).
          // Mantido para preservar a UI atual de hasStudyPlan/subjects/exam_date/weeklySchedule. Não migrar sem redesign de UX.
          supabase.from("study_plans").select("plan_json").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("reviews").select("next_review, flashcard_id, flashcards(topic)").eq("user_id", userId).gte("next_review", new Date().toISOString()).order("next_review", { ascending: true }).limit(5),
          supabase.from("discursive_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).not("finished_at", "is", null),
          supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("is_global", true),
          supabase.from("questions_bank").select("id", { count: "exact", head: true }).eq("is_global", true).eq("review_status", "approved"),
          supabase.from("questions_bank").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("summaries").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("chat_conversations").select("id, agent_type", { count: "exact" }).eq("user_id", userId),
          supabase.from("medical_image_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("diagnostic_results").select("id", { count: "exact", head: true }).eq("user_id", userId),
        ]);

        const [teacherSimuladoRes, teacherClinicalRes] = await Promise.all([
          supabase.from("teacher_simulado_results").select("total_questions, score").eq("student_id", userId),
          supabase.from("teacher_clinical_case_results").select("id", { count: "exact", head: true }).eq("student_id", userId),
        ]);

        // Use coreData for shared data
        const practiceAttempts = cd.practiceAttempts;
        const todayStr = new Date().toISOString().split("T")[0];
        const questionsToday = practiceAttempts.filter(a => a.created_at?.startsWith(todayStr)).length;
        const practiceCorrect = practiceAttempts.filter(a => a.correct).length;
        const practiceTotal = practiceAttempts.length;

        const examData = cd.examSessions;
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

        const pendingRevisoes = cd.revisoes.filter(r => {
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
          anamnesisCompleted: cd.anamnesisResults.length,
          summariesCreated: summariesRes.count || 0,
          chroniclesCompleted: (chroniclesRes.data || []).filter((c: any) => c.agent_type === "medical-chronicle").length,
          imageQuizAttempts: imageQuizRes.count || 0,
          diagnosticCompleted: diagnosticRes.count || 0,
          chatConversations: chroniclesRes.count || 0,
        };

        // Build stats
        const tasks = tasksRes.data || [];
        const completedTasks = tasks.filter((t: any) => t.completed).length;

        const weekMap: Record<string, { hours: number; timestamp: number }> = {};
        for (const task of tasks) {
          if (!(task as any).completed) continue;
          const date = new Date((task as any).created_at);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const key = `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`;
          const taskJson = (task as any).task_json as any;
          const durationMatch = taskJson?.duration?.match?.(/(\d+(?:\.\d+)?)/);
          const hours = durationMatch ? parseFloat(durationMatch[1]) : 1;
          if (!weekMap[key]) weekMap[key] = { hours: 0, timestamp: weekStart.getTime() };
          weekMap[key].hours += hours;
        }
        const weeklyChart = Object.entries(weekMap)
          .sort((a, b) => a[1].timestamp - b[1].timestamp)
          .map(([week, { hours, timestamp }]) => ({ week, hours: Math.round(hours * 10) / 10, timestamp }));

        const plan = plansRes.data?.plan_json as PlanJson | null;
        const hasStudyPlan = plan !== null && !!plan?.weeklySchedule;
        const subjects = plan?.subjects || [];
        const subjectHours: Record<string, number> = {};
        let totalStudyHours = 0;

        if (plan?.weeklySchedule) {
          for (const day of plan.weeklySchedule) {
            for (const task of day.tasks) {
              const match = task.duration.match(/(\d+(?:\.\d+)?)/);
              const hours = match ? parseFloat(match[1]) : 1;
              subjectHours[task.subject] = (subjectHours[task.subject] || 0) + hours;
              totalStudyHours += hours;
            }
          }
        }

        let daysUntilExam: number | null = null;
        if (plan?.config?.examDate) {
          const diff = new Date(plan.config.examDate).getTime() - Date.now();
          if (diff > 0) daysUntilExam = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        const upcomingReviews = (reviewsRes.data || []).map((r: any) => ({
          topic: r.flashcards?.topic || "Sem tópico",
          next: r.next_review,
        }));

        const DAY_MAP: Record<string, number> = { Dom: 0, Seg: 1, Ter: 2, Qua: 3, Qui: 4, Sex: 5, "Sáb": 6, Sab: 6 };
        const todayDow = new Date().getDay();
        const todaySchedule = plan?.weeklySchedule?.find((d) => DAY_MAP[d.day] === todayDow);
        const todayTotal = todaySchedule?.tasks.length || 0;
        const completedToday = tasks.filter((t: any) => {
          if (!t.completed) return false;
          const d = new Date(t.created_at);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });

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
          displayName: cd.profile.display_name,
          hasCompletedDiagnostic: cd.profile.has_completed_diagnostic,
          targetExams: cd.profile.target_exams,
        };

        // Write-through: persist snapshot for next fast-path
        saveDashboardSnapshot(userId, result);

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
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
