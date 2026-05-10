/**
 * NextBestActionCard
 * ──────────────────
 * Recomendação única e óbvia, derivada de sinais que JÁ estão em cache:
 *   1) FSRS due > 0           → Revisar
 *   2) Tasks pendentes hoje   → Continuar missão
 *   3) Erro recente           → Treinar fraqueza
 *   4) Senão                  → Falar com o Tutor
 *
 * NÃO cria queries novas — usa hooks já carregados pelos outros cards.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, ArrowRight } from "lucide-react";
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Action = {
  label: string;
  description: string;
  cta: string;
  to: string;
};

interface NextBestActionCardProps {
  /** Lista de paths já cobertos por outros cards visíveis no Dashboard.
   *  Se o NBA apontar para um deles, o card é ocultado (evita duplicação de ação). */
  excludePaths?: string[];
}

export default function NextBestActionCard({ excludePaths = [] }: NextBestActionCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { totalDue } = useFsrsDueCount();
  const { data: dash } = useDashboardData();
  const [hasRecentError, setHasRecentError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("error_bank")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("dominado", false)
          .gte("updated_at", sinceIso);
        if (!cancelled) setHasRecentError((count ?? 0) > 0);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const todayPending = useMemo(() => {
    const total = dash?.stats.todayTotal ?? 0;
    const done = dash?.stats.todayCompleted ?? 0;
    return Math.max(0, total - done);
  }, [dash]);

  const action: Action = useMemo(() => {
    if (totalDue > 0) {
      return {
        label: "Atalho rápido",
        description: `${totalDue} ${totalDue === 1 ? "revisão pronta" : "revisões prontas"} agora`,
        cta: "Revisar",
        to: "/dashboard/revisoes?source=guided_nba",
      };
    }
    if (todayPending > 0) {
      return {
        label: "Atalho rápido",
        description: `${todayPending} ${todayPending === 1 ? "tarefa pendente" : "tarefas pendentes"} hoje`,
        cta: "Continuar missão",
        to: "/dashboard/planner?source=guided_nba",
      };
    }
    if (hasRecentError) {
      return {
        label: "Atalho rápido",
        description: "Reforçar pontos fracos recentes",
        cta: "Treinar agora",
        to: "/dashboard/banco-erros?source=guided_nba",
      };
    }
    return {
      label: "Atalho rápido",
      description: "Sem pendências — peça uma orientação ao Tutor",
      cta: "Falar com Tutor",
      to: "/dashboard/mentor?source=guided_nba",
    };
  }, [totalDue, todayPending, hasRecentError]);

  // Ajuste 2: deduplicação — se o destino do NBA já está coberto por outro card, esconde
  const actionBasePath = action.to.split("?")[0];
  const isDuplicate = excludePaths.some((p) => p.split("?")[0] === actionBasePath);
  if (isDuplicate) return null;

  return (
    <Card className="overflow-hidden border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Compass className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{action.label}</p>
            <p className="text-xs text-muted-foreground truncate">{action.description}</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate(action.to)} className="shrink-0">
          {action.cta}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
