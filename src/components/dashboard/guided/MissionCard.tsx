/**
 * MissionCard (Guided) — Nível 2
 * ──────────────────────────────
 * Resume a missão do dia (daily_plan_tasks via useDashboardData).
 * - Com tasks: progresso, contagem, minutos restantes (estimativa) + "Continuar".
 * - Sem tasks: CTA "Gerar missão do dia".
 *
 * Reusa useDashboardData (sem nova query). Estimativa de minutos restantes
 * deriva de subjectHours (média por task pendente).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight, Plus, Clock, Loader2 } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function MissionCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardData();

  const total = data?.stats.todayTotal ?? 0;
  const done = data?.stats.todayCompleted ?? 0;
  const remaining = Math.max(0, total - done);
  const hasPlan = data?.stats.hasStudyPlan ?? false;
  const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  // Estimativa simples: 25min por tarefa pendente (média típica de bloco de estudo).
  const minutesLeft = remaining * 25;

  const handleContinue = () => navigate("/dashboard/sessao-estudo", { state: { source: "daily_plan", mode: "guided_tasks" } });
  const handleGenerate = () => navigate("/dashboard/planner?source=guided_mission");

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400 shrink-0">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Plano do dia</p>
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Carregando…"
                  : total > 0
                  ? `${done}/${total} concluídas`
                  : hasPlan
                  ? "Sem tarefas para hoje"
                  : "Nenhum plano ativo"}
              </p>
            </div>
          </div>
          {total > 0 ? (
            <Button size="sm" variant="outline" onClick={handleContinue} className="shrink-0">
              Continuar
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleGenerate} className="shrink-0">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Gerar missão
            </Button>
          )}
        </div>

        {total > 0 && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
                aria-label={`Progresso ${progress}%`}
              />
            </div>
            {remaining > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>~{minutesLeft} min restantes</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
