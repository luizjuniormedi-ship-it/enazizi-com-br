import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, ChevronUp, Rocket, Star, X } from "lucide-react";
import type { DashboardMetrics, DashboardStats } from "@/hooks/useDashboardData";

interface ChecklistItem {
  id: string;
  day: number;
  title: string;
  description: string;
  xp: number;
  path: string;
  isComplete: boolean;
}

interface Props {
  stats: DashboardStats;
  metrics: DashboardMetrics;
  hasCompletedDiagnostic: boolean;
}

const DISMISSED_KEY = "onboarding_checklist_dismissed_v2";

export default function OnboardingChecklist({ stats, metrics, hasCompletedDiagnostic }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");

  // Fallback check for diagnostic completion
  const { data: diagnosticCount } = useQuery({
    queryKey: ["diagnostic-count", user?.id],
    enabled: !!user && !hasCompletedDiagnostic,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase
        .from("diagnostic_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count || 0;
    },
  });

  const diagnosticDone = hasCompletedDiagnostic || (diagnosticCount ?? 0) > 0;

  const items: ChecklistItem[] = useMemo(() => [
    {
      id: "diagnostic",
      day: 1,
      title: "Faça o Nivelamento Inicial",
      description: "Descubra seu nível em cada especialidade médica",
      xp: 50,
      path: "/dashboard/diagnostico",
      isComplete: diagnosticDone,
    },
    {
      id: "questions",
      day: 2,
      title: "Responda 10 Questões",
      description: "Pratique com questões do banco global",
      xp: 30,
      path: "/dashboard/simulados",
      isComplete: metrics.questionsAnswered >= 10,
    },
    {
      id: "flashcards",
      day: 3,
      title: "Crie seus Flashcards",
      description: "Gere flashcards com IA sobre um tema",
      xp: 30,
      path: "/dashboard/gerar-flashcards",
      isComplete: stats.flashcards > 0,
    },
    {
      id: "cronograma",
      day: 4,
      title: "Monte seu Cronograma",
      description: "Adicione temas e ative a revisão espaçada",
      xp: 40,
      path: "/dashboard/planner",
      isComplete: stats.todayTotal > 0 || metrics.pendingRevisoes > 0,
    },
    {
      id: "simulado",
      day: 5,
      title: "Faça um Simulado",
      description: "Teste em condições de prova real",
      xp: 50,
      path: "/dashboard/simulados",
      isComplete: metrics.simuladosCompleted > 0,
    },
    {
      id: "clinical",
      day: 6,
      title: "Simulação Clínica",
      description: "Treine conduta médica com um caso interativo",
      xp: 50,
      path: "/dashboard/simulacao-clinica",
      isComplete: metrics.clinicalSimulations > 0,
    },
    {
      id: "tutor",
      day: 7,
      title: "Estude com o Tutor IA",
      description: "Aprofunde um tema com o protocolo ENAZIZI",
      xp: 40,
      path: "/dashboard/agentes",
      isComplete: metrics.summariesCreated > 0 || metrics.anamnesisCompleted > 0,
    },
  ], [stats, metrics, diagnosticDone]);

  const completed = items.filter((i) => i.isComplete).length;
  const totalXp = items.filter((i) => i.isComplete).reduce((s, i) => s + i.xp, 0);
  const percent = Math.round((completed / items.length) * 100);
  const allDone = completed === items.length;

  // Auto-dismiss when all done
  useEffect(() => {
    if (allDone && !dismissed) {
      // keep visible for a bit so user sees 100%
    }
  }, [allDone, dismissed]);

  if (dismissed) return null;

  return (
    <Card className="border-primary/10 bg-primary/5 overflow-hidden shadow-sm rounded-2xl">
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                <Rocket className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-black tracking-tight uppercase">
                Jornada de 7 Dias
              </CardTitle>
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase opacity-70">
              Explore o ENAZIZI e ganhe XP
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 gap-1.5 font-bold border-0 h-7 rounded-lg">
              <Star className="h-3.5 w-3.5 fill-amber-500" /> {totalXp} XP
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {allDone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                onClick={() => {
                  localStorage.setItem(DISMISSED_KEY, "true");
                  setDismissed(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1 mt-4">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground/80 tracking-widest px-1">
            <span>Progresso da Jornada</span>
            <span>{percent}%</span>
          </div>
          <Progress value={percent} className="h-2 rounded-full bg-primary/10" />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-5 pb-5 pt-1 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent ${
                  item.isComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-900/10 opacity-60 border-emerald-100/20"
                    : "bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/30 hover:border-primary/20 hover:shadow-sm"
                }`}
                onClick={() => !item.isComplete && navigate(item.path)}
              >
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-xl shrink-0 text-xs font-black shadow-sm transition-transform group-hover:scale-105 ${
                    item.isComplete
                      ? "bg-emerald-500 text-white shadow-emerald-500/20"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {item.isComplete ? <Check className="h-4 w-4 stroke-[3px]" /> : item.day}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-bold leading-tight ${item.isComplete ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-tight">{item.description}</p>
                </div>
                {!item.isComplete && (
                  <Badge variant="outline" className="text-[10px] font-bold shrink-0 border-0 bg-primary/5 text-primary">
                    +{item.xp}
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {allDone && (
            <div className="text-center py-4 px-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 mt-2">
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">🎉 Jornada de Boas-Vindas Completa!</p>
              <p className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80 mt-1">Você explorou o núcleo do ENAZIZI e acumulou {totalXp} XP.</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
