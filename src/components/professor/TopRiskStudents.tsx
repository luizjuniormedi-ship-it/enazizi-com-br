/**
 * TopRiskStudents
 * Painel operacional: lista priorizada de alunos em risco hoje.
 * Consome action `class_analytics` (já existente — atRiskStudents).
 * Cada linha tem motivo + gravidade + ação direta.
 *
 * Sem dados → DadosInsuficientesCard.
 * Sem mocks. Sem KPIs fake.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, AlertCircle, UserX, Activity, ArrowRight, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { cn } from "@/lib/utils";

interface RiskStudent {
  user_id: string;
  display_name: string;
  faculdade?: string;
  periodo?: string;
  avg_domain_score: number;
  days_inactive: number;
  streak: number;
  total_errors: number;
  questions_answered: number;
  risk_reason: string;
  risk_level: "critical" | "warning";
}

interface Props {
  analytics: any | null;
  loading: boolean;
  error?: string | null;
  onReload?: () => void;
  onAssignRecovery?: (studentId: string, name: string, suggestedSpecialty?: string) => void;
  onOpenMentor?: (studentId: string) => void;
  onOpenDrawer?: (studentId: string) => void;
}

export default function TopRiskStudents({
  analytics,
  loading,
  error,
  onReload,
  onAssignRecovery,
  onOpenMentor,
  onOpenDrawer,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");

  const students = useMemo<RiskStudent[]>(() => {
    const list: RiskStudent[] = Array.isArray(analytics?.atRiskStudents) ? analytics.atRiskStudents : [];
    return [...list]
      .filter(s => 
        (s.display_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.risk_reason || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (a.risk_level !== b.risk_level) return a.risk_level === "critical" ? -1 : 1;
        if (a.avg_domain_score !== b.avg_domain_score) return a.avg_domain_score - b.avg_domain_score;
        return b.days_inactive - a.days_inactive;
      });
  }, [analytics, searchTerm]);

  if (loading) {
    return (
      <Card className="p-6 space-y-3">
        <div className="h-4 w-1/3 bg-white/10 rounded animate-pulse" />
        <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-20 bg-white/5 rounded-2xl animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-rose-300">{error}</p>
          {onReload && (
            <Button size="sm" variant="outline" onClick={onReload}>
              <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!students || students.length === 0) {
    return (
      <DadosInsuficientesCard
        title="Nenhum aluno em risco hoje"
        description="Quando houver queda de retenção, abandono ou theta caindo, os alunos aparecerão priorizados aqui."
        icon={<Activity className="h-4 w-4 text-emerald-400" />}
      />
    );
  }

  const critical = students.filter(s => s.risk_level === "critical").length;
  const warning = students.filter(s => s.risk_level === "warning").length;

  return (
    <div className="space-y-4">
      {/* Header operacional */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">Alunos em risco hoje</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Lista priorizada por gravidade. Bata o olho e intervenha.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 && (
            <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30">
              <AlertCircle className="h-3 w-3 mr-1" /> {critical} crítico{critical > 1 ? "s" : ""}
            </Badge>
          )}
          {warning > 0 && (
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" /> {warning} atenção
            </Badge>
          )}
          {onReload && (
            <Button size="sm" variant="ghost" onClick={onReload}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          <Activity className="h-4 w-4" />
        </div>
        <input 
          type="text"
          placeholder="Buscar aluno por nome ou motivo de risco..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full h-11 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* Lista priorizada */}
      <div className="space-y-2">
        {students.slice(0, 20).map((s) => (
          <div
            key={s.user_id}
            className={cn(
              "flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border backdrop-blur-md transition-colors",
              s.risk_level === "critical"
                ? "bg-rose-500/5 border-rose-500/20"
                : "bg-amber-500/5 border-amber-500/15"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0",
                s.risk_level === "critical" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"
              )}>
                {s.risk_level === "critical" ? <AlertCircle className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{s.display_name}</div>
                <div className="text-[11px] text-white/60 mt-0.5">
                  {s.risk_reason}
                  {s.faculdade ? ` · ${s.faculdade}${s.periodo ? ` · ${s.periodo}` : ""}` : ""}
                </div>
                <div className="text-[10px] text-white/40 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Score {s.avg_domain_score}%</span>
                  <span>· Streak {s.streak}d</span>
                  <span>· Inativo {s.days_inactive}d</span>
                  <span>· {s.questions_answered} questões</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {onAssignRecovery && (
                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold uppercase tracking-wider"
                  onClick={() => onAssignRecovery(s.user_id, s.display_name)}>
                  <Target className="h-3 w-3 mr-1" /> Recovery
                </Button>
              )}
              {onOpenMentor && (
                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold uppercase tracking-wider"
                  onClick={() => onOpenMentor(s.user_id)}>
                  Mentoria
                </Button>
              )}
              {onOpenDrawer && (
                <Button size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider"
                  onClick={() => onOpenDrawer(s.user_id)}>
                  Detalhes <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {students.length > 20 && (
        <p className="text-[11px] text-white/40 text-center">
          Mostrando os 20 alunos com maior prioridade · {students.length - 20} em vigilância secundária
        </p>
      )}
    </div>
  );
}
