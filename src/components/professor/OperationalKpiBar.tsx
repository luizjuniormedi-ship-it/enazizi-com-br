/**
 * OperationalKpiBar
 * KPIs operacionais reais no topo do grupo Operacional.
 * Consome `class_analytics` (já carregado pelos filhos via callAPI) — recebe via prop
 * para evitar dupla query (deduplication).
 *
 * KPIs verdadeiros (do backend atual):
 *  - Total de alunos
 *  - Em risco crítico
 *  - Em atenção
 *  - Inativos > 7d
 *  - Taxa de conclusão de atividades
 *
 * KPIs cognitivos (Theta médio · Stability · Recovery overload · Burnout)
 * são marcados como "em construção" — NÃO inventamos valor.
 */
import { Activity, AlertCircle, AlertTriangle, UserX, CheckCircle2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsLite {
  students?: any[];
  atRiskStudents?: any[];
  engagement?: {
    avg_streak: number;
    avg_xp: number;
    inactive_count: number;
    activity_completion_rate: number;
  };
}

interface Props {
  analytics: AnalyticsLite | null;
  loading?: boolean;
}

export default function OperationalKpiBar({ analytics, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const students = analytics?.students || [];
  const atRisk = analytics?.atRiskStudents || [];
  const critical = atRisk.filter((s: any) => s.risk_level === "critical").length;
  const warning = atRisk.filter((s: any) => s.risk_level === "warning").length;
  const inactive = analytics?.engagement?.inactive_count ?? 0;
  const completion = analytics?.engagement?.activity_completion_rate ?? 0;

  const kpis = [
    { icon: Activity, label: "Alunos ativos", value: students.length, tone: "neutral" as const },
    { icon: AlertCircle, label: "Crítico", value: critical, tone: "critical" as const },
    { icon: AlertTriangle, label: "Atenção", value: warning, tone: "warning" as const },
    { icon: UserX, label: "Inativos > 7d", value: inactive, tone: inactive > 0 ? "warning" : "neutral" as const },
    { icon: CheckCircle2, label: "Conclusão", value: `${completion}%`, tone: completion >= 70 ? "good" : "neutral" as const },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>
      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-white/40 shrink-0" />
        <p className="text-[10px] text-white/45 leading-snug">
          Theta TRI médio, Stability FSRS, Recovery overload e Burnout risk
          aparecerão aqui assim que o pipeline cognitivo expor essas agregações por turma.
          Sem dado real, não exibimos valor.
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "neutral" | "good" | "warning" | "critical";
}) {
  const toneClass = {
    neutral: "border-white/10 bg-white/[0.03]",
    good: "border-emerald-500/25 bg-emerald-500/5",
    warning: "border-amber-500/25 bg-amber-500/5",
    critical: "border-rose-500/30 bg-rose-500/5",
  }[tone];
  const iconClass = {
    neutral: "text-white/50",
    good: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-rose-400",
  }[tone];

  return (
    <div className={cn("rounded-xl border px-3 py-2.5", toneClass)}>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-white/50">
        <Icon className={cn("h-3 w-3", iconClass)} />
        {label}
      </div>
      <div className="text-xl font-black text-white mt-0.5">{value}</div>
    </div>
  );
}
