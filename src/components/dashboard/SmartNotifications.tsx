/**
 * @deprecated [Alert Orchestrator — Fase 2]
 * Substituído por `RiskAlertsCard` + `useAlertOrchestrator`.
 * Mantido como legacy (0 imports). Não usar.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, Target, Flame, Brain, Stethoscope, BookOpen } from "lucide-react";
import { generateRecommendations } from "@/lib/studyEngine";
import { buildStudyPath } from "@/lib/studyRouter";

interface SmartNotification {
  id: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; path: string };
  severity: "info" | "warning" | "critical";
}

export default function SmartNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ["smart-notifications", user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const notifs: SmartNotification[] = [];
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const hour = now.getHours();

      // Parallel data fetching
      const [overdueRes, todayQuestionsRes, configRes, gamifRes, recsResult] = await Promise.all([
        supabase
          .from("revisoes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("status", "pendente")
          .lt("data_revisao", todayStr),
        supabase
          .from("practice_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .gte("created_at", `${todayStr}T00:00:00`),
        supabase
          .from("cronograma_config")
          .select("meta_questoes_dia")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("user_gamification")
          .select("current_streak")
          .eq("user_id", user!.id)
          .maybeSingle(),
        generateRecommendations({ userId: user!.id }).then(r => r.recommendations).catch(() => [] as any[]),
      ]);

      const overdueCount = overdueRes.count || 0;
      const questionsToday = todayQuestionsRes.count || 0;
      const streak = gamifRes.data?.current_streak || 0;
      const recs = recsResult || [];

      // 1. Overdue reviews
      if (overdueCount > 0) {
        const reviewRec = recs.find(r => r.type === "review");
        notifs.push({
          id: "overdue-reviews",
          icon: <CalendarClock className="h-4 w-4" />,
          title: `${overdueCount} ${overdueCount === 1 ? "revisão vencida" : "revisões vencidas"}`,
          message: "Revisões atrasadas aumentam o risco de esquecimento. Faça agora para manter a retenção.",
          action: reviewRec
            ? { label: "Revisar Agora", path: buildStudyPath(reviewRec) }
            : { label: "Ir ao Planner", path: "/dashboard/planner" },
          severity: overdueCount > 5 ? "critical" : "warning",
        });
      }

      // 2. Daily question goal (only if configured)
      const hasConfiguredGoal = configRes.data !== null && configRes.data?.meta_questoes_dia !== null;
      const dailyGoal = configRes.data?.meta_questoes_dia || 30;

      if (hasConfiguredGoal && hour >= 14 && questionsToday < dailyGoal * 0.5) {
        const practiceRec = recs.find(r => r.type === "practice");
        notifs.push({
          id: "daily-goal",
          icon: <Target className="h-4 w-4" />,
          title: `Meta diária: ${questionsToday}/${dailyGoal} questões`,
          message: `Você fez apenas ${Math.round((questionsToday / dailyGoal) * 100)}% da meta de hoje. Aproveite o restante do dia!`,
          action: practiceRec
            ? { label: "Praticar Agora", path: buildStudyPath(practiceRec) }
            : { label: "Praticar Questões", path: "/dashboard/simulados" },
          severity: hour >= 18 ? "critical" : "warning",
        });
      }

      // 3. Streak risk
      if (streak >= 3 && hour >= 16 && questionsToday === 0) {
        const topRec = recs[0];
        notifs.push({
          id: "streak-risk",
          icon: <Flame className="h-4 w-4" />,
          title: `Streak de ${streak} dias em risco! 🔥`,
          message: "Você ainda não estudou hoje. Faça pelo menos 1 atividade para não perder sua sequência!",
          action: topRec
            ? { label: "Estudar Agora", path: buildStudyPath(topRec) }
            : { label: "Estudar Agora", path: "/dashboard/mentor" },
          severity: "warning",
        });
      }

      // 4. Topic-specific: error bank recurring mistakes
      const errorRecs = recs.filter(r => r.type === "error_review");
      if (errorRecs.length > 0) {
        const topError = errorRecs[0];
        notifs.push({
          id: "recurring-errors",
          icon: <Brain className="h-4 w-4" />,
          title: `Tema recorrente: "${topError.topic}"`,
          message: topError.reason,
          action: { label: "Corrigir Agora", path: buildStudyPath(topError) },
          severity: topError.priority >= 80 ? "critical" : "warning",
        });
      }

      // 5. Clinical practice gap
      const clinicalRec = recs.find(r => r.type === "clinical");
      if (clinicalRec) {
        notifs.push({
          id: "clinical-gap",
          icon: <Stethoscope className="h-4 w-4" />,
          title: clinicalRec.topic,
          message: clinicalRec.reason,
          action: { label: "Praticar", path: buildStudyPath(clinicalRec) },
          severity: "info",
        });
      }

      // 6. New specialty to explore
      const newRec = recs.find(r => r.type === "new");
      if (newRec && notifs.length < 4) {
        notifs.push({
          id: "new-topic",
          icon: <BookOpen className="h-4 w-4" />,
          title: `Nova área: ${newRec.topic}`,
          message: newRec.reason,
          action: { label: "Começar", path: buildStudyPath(newRec) },
          severity: "info",
        });
      }

      return notifs;
    },
  });

  if (!notifications || notifications.length === 0) return null;

  const severityStyles = {
    info: "border-blue-500/30 bg-blue-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    critical: "border-destructive/30 bg-destructive/5",
  };

  const iconColors = {
    info: "text-blue-500",
    warning: "text-amber-500",
    critical: "text-destructive",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Notificações</span>
      </div>
      {notifications.slice(0, 4).map((n) => (
        <Alert key={n.id} className={`${severityStyles[n.severity]} py-3`}>
          <div className={iconColors[n.severity]}>{n.icon}</div>
          <AlertTitle className="text-sm font-semibold">{n.title}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span className="text-xs">{n.message}</span>
            {n.action && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs h-7"
                onClick={() => navigate(n.action!.path)}
              >
                {n.action.label}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
