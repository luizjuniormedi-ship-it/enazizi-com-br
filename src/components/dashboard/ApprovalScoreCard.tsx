import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, TrendingUp, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const STATUS_CONFIG = [
  { max: 50, label: "Crítico", color: "text-destructive", bg: "bg-destructive", border: "border-destructive/30", emoji: "🔴" },
  { max: 70, label: "Atenção", color: "text-yellow-500", bg: "bg-yellow-500", border: "border-yellow-500/30", emoji: "🟡" },
  { max: 85, label: "Competitivo", color: "text-emerald-500", bg: "bg-emerald-500", border: "border-emerald-500/30", emoji: "🟢" },
  { max: 100, label: "Pronto!", color: "text-primary", bg: "bg-primary", border: "border-primary/30", emoji: "🏆" },
];

function getStatus(score: number) {
  return STATUS_CONFIG.find((s) => score <= s.max) || STATUS_CONFIG[STATUS_CONFIG.length - 1];
}

interface ScoreData {
  score: number;
  accuracy: number;
  domain_score: number;
  review_score: number;
  consistency_score: number;
  simulation_score: number;
  error_penalty: number;
  details_json?: Record<string, any>;
}

export default function ApprovalScoreCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Read latest persisted score
  const { data: scoreData, isLoading, error, refetch } = useQuery({
    queryKey: ["approval-score-latest", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_scores")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as ScoreData | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const handleRecalculate = async () => {
    if (!user) return;
    setIsRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("calculate-approval-score", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      await refetch();
      toast.success("Score atualizado com sucesso");
    } catch (err) {
      console.error("Recalculate error:", err);
      toast.error("Não foi possível atualizar. Tente novamente.");
    } finally {
      setIsRecalculating(false);
    }
  };

  const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

  if (isLoading) {
    return (
      <Card className="border-muted animate-pulse">
        <CardContent className="p-4 h-[200px] flex flex-col justify-center items-center">
          <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Sincronizando chance de aprovação...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 flex flex-col items-center text-center">
          <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
          <p className="text-sm font-semibold text-destructive">Erro de sincronização</p>
          <p className="text-xs text-muted-foreground mb-3">Não foi possível carregar seu score.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const score = scoreData ? clampPercent(scoreData.score) : 0;
  const status = getStatus(score);

  // Build weak points from sub-dimensions
  const issues: string[] = [];
  if (scoreData) {
    if (scoreData.accuracy < 60) issues.push(`Acurácia em ${clampPercent(scoreData.accuracy)}% — revise os temas errados`);
    if (scoreData.review_score < 50) issues.push("Revisões acumuladas — priorize retomar");
    if (scoreData.consistency_score < 40) issues.push("Estudo irregular — tente manter frequência diária");
    if (scoreData.simulation_score < 50) issues.push("Poucos simulados — pratique mais provas completas");
    if (scoreData.error_penalty > 50) issues.push("Erros recorrentes — foque nos temas que mais erra");
    if (scoreData.domain_score < 50) issues.push("Algumas especialidades precisam de mais atenção");
  }

  return (
    <Card className={`${status.border} overflow-hidden`}>
      <CardContent className="p-0">
        {/* Score header */}
        <div className="flex items-center gap-4 p-4 pb-3">
          <div className="relative">
            <div className={`h-16 w-16 rounded-2xl ${status.bg}/10 flex items-center justify-center`}>
              <span
                className="text-2xl font-black tabular-nums"
                style={{
                  color: `hsl(var(--${score > 70 ? "primary" : score > 50 ? "warning" : "destructive"}))`,
                }}
              >
                {score}%
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className={`h-4 w-4 ${status.color}`} />
              <span className={`text-sm font-bold ${status.color}`}>
                {status.emoji} {status.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Chance de aprovação</p>
            <Progress value={score} className="h-2 mt-1.5" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleRecalculate}
            disabled={isRecalculating}
          >
            <RefreshCw className={`h-4 w-4 ${isRecalculating ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Sub-dimensions */}
        {scoreData && (
          <div className="px-4 pb-2 grid grid-cols-3 gap-2 text-[11px]">
            <div className="text-center">
              <p className="font-semibold text-foreground">{clampPercent(scoreData.accuracy)}%</p>
              <p className="text-muted-foreground">Acurácia</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{clampPercent(scoreData.review_score)}%</p>
              <p className="text-muted-foreground">Revisões</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{clampPercent(scoreData.simulation_score)}%</p>
              <p className="text-muted-foreground">Simulados</p>
            </div>
          </div>
        )}

        {/* Improvement points */}
        {issues.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Pontos para melhorar:
            </p>
            <div className="space-y-1">
              {issues.slice(0, 3).map((issue) => (
                <p key={issue} className="text-xs text-foreground/80 pl-4">
                  • {issue}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* No data state — uncertainty framing */}
        {!scoreData && (
          <div className="px-4 pb-3 text-center">
           <p className="text-xs text-muted-foreground mb-1">
              Descubra sua chance de aprovação
            </p>
            <p className="text-[11px] text-muted-foreground/70 mb-2">
              Analisamos seu desempenho e calculamos sua probabilidade
            </p>
            <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={isRecalculating}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRecalculating ? "animate-spin" : ""}`} />
              Calcular agora
            </Button>
          </div>
        )}

        {/* CTA */}
        <div className="px-4 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs h-8 text-primary hover:text-primary"
            onClick={() => navigate("/dashboard/planner")}
          >
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Ver Plano Geral
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
