/**
 * OperationalKpiBar V2
 * KPIs operacionais reais. KPIs cognitivos só renderizam se o backend enviar.
 * Nunca exibe "0" falso para campos null.
 */
import { Activity, AlertCircle, AlertTriangle, UserX, CheckCircle2, Brain, Flame, Zap, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CognitiveSummary {
  avg_theta: number | null;
  avg_stability: number | null;
  avg_retention: number | null;
  avg_lapses: number | null;
  avg_recovery_load: number | null;
  burnout_risk_students: number;
  overload_students: number;
  inactive_students: number;
  weakest_specialty: string | null;
  strongest_specialty: string | null;
  trend_7d: "up" | "down" | "stable" | null;
  trend_30d: "up" | "down" | "stable" | null;
  samples?: {
    retention_reviews: number;
    stability_cards: number;
    cognitive_events: number;
    students_with_data: number;
  };
}

interface AnalyticsLite {
  students?: any[];
  atRiskStudents?: any[];
  engagement?: {
    avg_streak: number;
    avg_xp: number;
    inactive_count: number;
    activity_completion_rate: number;
  };
  cognitive_summary?: CognitiveSummary | null;
  timestamp?: string;
}

interface Props {
  analytics: AnalyticsLite | null;
  loading?: boolean;
}

type Tone = "neutral" | "good" | "warning" | "critical" | "insufficient";
interface Kpi {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: Tone;
  insufficient?: boolean;
  sampleSize?: number;
  threshold?: number;
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
  const cog = analytics?.cognitive_summary || null;

  const operational: Kpi[] = [
    { icon: Activity, label: "Alunos ativos", value: students.length, tone: "neutral" },
    { icon: AlertCircle, label: "Crítico", value: critical, tone: "critical" },
    { icon: AlertTriangle, label: "Atenção", value: warning, tone: "warning" },
    { icon: UserX, label: "Inativos > 7d", value: inactive, tone: inactive > 0 ? "warning" : "neutral" },
    { icon: CheckCircle2, label: "Conclusão", value: `${completion}%`, tone: completion >= 70 ? "good" : "neutral" },
  ];

  const cognitive: Kpi[] = [];
  if (cog) {
    const samples = cog.samples || { retention_reviews: 0, cognitive_events: 0, stability_cards: 0, students_with_data: 0 };
    
    // Thresholds: Retention >= 20 reviews, Burnout/Events >= 10 events
    const hasRetentionData = samples.retention_reviews >= 20;
    const hasCognitiveData = samples.cognitive_events >= 10;

    if (cog.avg_retention !== null) {
      cognitive.push({
        icon: Brain,
        label: "Retenção média",
        value: hasRetentionData ? `${cog.avg_retention}%` : "---",
        tone: hasRetentionData ? (cog.avg_retention >= 75 ? "good" : cog.avg_retention >= 60 ? "warning" : "critical") : "insufficient",
        insufficient: !hasRetentionData,
        sampleSize: samples.retention_reviews,
        threshold: 20
      });
    }

    if (cog.avg_lapses !== null) {
      cognitive.push({
        icon: TrendingDown,
        label: "Lapses médio",
        value: hasCognitiveData ? cog.avg_lapses : "---",
        tone: hasCognitiveData ? (cog.avg_lapses <= 1 ? "good" : cog.avg_lapses <= 2 ? "warning" : "critical") : "insufficient",
        insufficient: !hasCognitiveData,
        sampleSize: samples.cognitive_events,
        threshold: 10
      });
    }

    if (cog.avg_stability !== null) {
      cognitive.push({
        icon: Brain,
        label: "Stability FSRS",
        value: hasCognitiveData ? cog.avg_stability : "---",
        tone: hasCognitiveData ? (cog.avg_stability >= 5 ? "good" : cog.avg_stability >= 2 ? "warning" : "critical") : "insufficient",
        insufficient: !hasCognitiveData,
        sampleSize: samples.cognitive_events,
        threshold: 10
      });
    }

    if (cog.overload_students > 0 || !hasCognitiveData) {
      cognitive.push({
        icon: Zap,
        label: "Sobrecarga",
        value: hasCognitiveData ? cog.overload_students : "---",
        tone: hasCognitiveData ? "warning" : "insufficient",
        insufficient: !hasCognitiveData,
        sampleSize: samples.cognitive_events,
        threshold: 10
      });
    }

    if (cog.burnout_risk_students > 0 || !hasCognitiveData) {
      cognitive.push({
        icon: Flame,
        label: "Risco burnout",
        value: hasCognitiveData ? cog.burnout_risk_students : "---",
        tone: hasCognitiveData ? "critical" : "insufficient",
        insufficient: !hasCognitiveData,
        sampleSize: samples.cognitive_events,
        threshold: 10
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {operational.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {cognitive.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {cognitive.map((k, i) => <KpiCard key={`c${i}`} {...k} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-white/40 shrink-0" />
          <p className="text-[10px] text-white/45 leading-snug">
            KPIs cognitivos (retenção, stability, lapses, burnout) aparecem aqui assim que houver
            dados FSRS/practice suficientes na turma. Sem dado real, não exibimos valor.
          </p>
        </div>
      )}

      {cog?.weakest_specialty && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2 text-[11px] text-rose-200/80">
          Especialidade coletivamente mais fraca: <strong className="text-rose-100">{cog.weakest_specialty}</strong>
          {cog.strongest_specialty && <> · mais forte: <strong className="text-emerald-200">{cog.strongest_specialty}</strong></>}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: Kpi) {
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
