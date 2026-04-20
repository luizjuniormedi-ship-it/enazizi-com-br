/**
 * RiskAlertsCard — Alertas curtos e acionáveis no Dashboard
 * ──────────────────────────────────────────────────────────
 * Mostra no MÁX 3 alertas de risco simultâneos:
 *   - 7 dias sem questões
 *   - sem exam_date
 *   - revisões FSRS pendentes (>50)
 *   - 0 tarefas concluídas na semana
 */
import { AlertTriangle, Flame, CalendarX, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useStudyEngineImpact } from "@/hooks/useStudyEngineImpact";
import { useCoreData } from "@/hooks/useCoreData";
import { useApprovalPrediction } from "@/hooks/useApprovalPrediction";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AlertItem {
  icon: typeof AlertTriangle;
  text: string;
  to?: string;
  tone: "warn" | "danger";
}

export default function RiskAlertsCard() {
  const { user } = useAuth();
  const { data: impact } = useStudyEngineImpact();
  const { data: coreData } = useCoreData();

  // Pending FSRS reviews (cheap count query)
  const { data: pendingReviews = 0 } = useQuery({
    queryKey: ["fsrs-pending-count", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("fsrs_cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .lte("due", new Date().toISOString());
      return count ?? 0;
    },
  });

  if (!impact || !coreData) return null;

  const alerts: AlertItem[] = [];

  if (impact.questions7d === 0) {
    alerts.push({
      icon: AlertTriangle,
      text: "Você está há 7 dias sem praticar questões",
      to: "/banco-questoes",
      tone: "danger",
    });
  }

  if (!coreData.profile.exam_date) {
    alerts.push({
      icon: CalendarX,
      text: "Você ainda não informou a data da prova",
      tone: "warn",
    });
  }

  if (pendingReviews > 50) {
    alerts.push({
      icon: Flame,
      text: `Você tem ${pendingReviews} revisões pendentes`,
      to: "/flashcards",
      tone: "danger",
    });
  }

  if (
    impact.tasksCreated7d > 0 &&
    impact.tasksCompleted7d === 0 &&
    alerts.length < 3
  ) {
    alerts.push({
      icon: AlertTriangle,
      text: "Nenhuma tarefa foi concluída esta semana",
      to: "/cronograma",
      tone: "warn",
    });
  }

  if (alerts.length === 0) return null;

  const visible = alerts.slice(0, 3);

  return (
    <div className="space-y-1.5">
      {visible.map((a, i) => {
        const Icon = a.icon;
        const cls =
          a.tone === "danger"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
        const inner = (
          <div className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-2 border ${cls}`}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{a.text}</span>
          </div>
        );
        return a.to ? (
          <Link key={i} to={a.to} className="block hover:opacity-80 transition-opacity">
            {inner}
          </Link>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
    </div>
  );
}
