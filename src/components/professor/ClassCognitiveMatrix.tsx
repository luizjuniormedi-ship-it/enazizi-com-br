/**
 * ClassCognitiveMatrix (Fase 4)
 * Matriz 2D: especialidade × métrica cognitiva.
 * Consome `cognitive_matrix` retornado por class_analytics.
 * Sem mocks. Sem dado → DadosInsuficientesCard.
 */
import { useMemo } from "react";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatrixCell {
  specialty: string;
  metric: "theta" | "retention" | "lapses" | "recovery_load" | "difficulty" | "stability";
  value: number | null;
  trend_7d: number | null;
  trend_30d: number | null;
  severity: "good" | "attention" | "risk" | "critical" | "unknown";
  sample_size: number;
}

interface Props {
  analytics: { cognitive_matrix?: MatrixCell[] | null } | null;
  loading?: boolean;
}

const METRICS: { key: MatrixCell["metric"]; label: string; suffix?: string }[] = [
  { key: "retention", label: "Retenção", suffix: "%" },
  { key: "lapses", label: "Lapses" },
  { key: "stability", label: "Stability" },
  { key: "recovery_load", label: "Carga" },
  { key: "difficulty", label: "Domínio", suffix: "%" },
];

const SEV_CLASS: Record<MatrixCell["severity"], string> = {
  good: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",
  attention: "bg-amber-500/15 border-amber-500/30 text-amber-200",
  risk: "bg-orange-500/15 border-orange-500/30 text-orange-200",
  critical: "bg-rose-500/20 border-rose-500/40 text-rose-200",
  unknown: "bg-white/[0.03] border-white/10 text-white/40",
};

export default function ClassCognitiveMatrix({ analytics, loading }: Props) {
  const cells = analytics?.cognitive_matrix || [];

  const specialties = useMemo(
    () => Array.from(new Set(cells.map(c => c.specialty))).slice(0, 12),
    [cells]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!cells.length || !specialties.length) {
    return (
      <DadosInsuficientesCard
        title="Matriz cognitiva em construção"
        description="Assim que houver dados de retenção, lapses e estabilidade FSRS por especialidade, a matriz aparecerá aqui."
        icon={<Layers className="h-4 w-4 text-primary/70" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-black text-white">Matriz cognitiva da turma</h3>
        <p className="text-xs text-white/50 mt-0.5">
          Cada linha é uma especialidade. Cada coluna é uma métrica cognitiva real.
        </p>
      </div>

      {/* Desktop: matriz */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Especialidade</th>
              {METRICS.map(m => (
                <th key={m.key} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specialties.map(sp => (
              <tr key={sp} className="border-t border-white/[0.04]">
                <td className="px-3 py-2 font-bold text-white/85 truncate max-w-[180px]">{sp}</td>
                {METRICS.map(m => {
                  const cell = cells.find(c => c.specialty === sp && c.metric === m.key);
                  return (
                    <td key={m.key} className="px-2 py-2">
                      <Cell cell={cell} suffix={m.suffix} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards por especialidade */}
      <div className="md:hidden space-y-2">
        {specialties.map(sp => (
          <div key={sp} className="rounded-2xl border border-white/[0.06] p-3 bg-white/[0.02]">
            <div className="text-xs font-black text-white/85 mb-2 truncate">{sp}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {METRICS.map(m => {
                const cell = cells.find(c => c.specialty === sp && c.metric === m.key);
                return (
                  <div key={m.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-white/5 bg-white/[0.02]">
                    <span className="text-[10px] uppercase font-bold text-white/50">{m.label}</span>
                    <Cell cell={cell} suffix={m.suffix} compact />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Legend />
    </div>
  );
}

function Cell({ cell, suffix, compact }: { cell?: MatrixCell; suffix?: string; compact?: boolean }) {
  if (!cell || cell.value === null) {
    return <span className="text-[10px] text-white/40">—</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-black",
        SEV_CLASS[cell.severity],
        compact ? "text-[11px]" : "text-xs"
      )}
      title={`amostra ${cell.sample_size}`}
    >
      {cell.value}
      {suffix || ""}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-white/50">
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Bom</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Atenção</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" /> Risco</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Crítico</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" /> Sem dado</span>
    </div>
  );
}
