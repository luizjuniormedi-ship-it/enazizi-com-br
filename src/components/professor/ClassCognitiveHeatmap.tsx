/**
 * ClassCognitiveHeatmap
 * Mapa de calor coletivo: especialidade x score médio.
 * Consome `class_analytics.specialtyBreakdown`. Sem mocks.
 */
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Layers } from "lucide-react";
import { DadosInsuficientesCard } from "@/components/common/DadosInsuficientesCard";
import { cn } from "@/lib/utils";

interface SpecialtyStat {
  specialty: string;
  avg_score: number;
  student_count: number;
}

interface Props {
  callAPI: (body: Record<string, unknown>) => Promise<any>;
}

function colorFor(score: number) {
  // 0-39 crítico, 40-59 fraco, 60-74 ok, 75-89 bom, 90+ forte
  if (score >= 90) return "bg-emerald-500/25 border-emerald-500/40 text-emerald-100";
  if (score >= 75) return "bg-emerald-500/15 border-emerald-500/25 text-emerald-200";
  if (score >= 60) return "bg-sky-500/15 border-sky-500/25 text-sky-200";
  if (score >= 40) return "bg-amber-500/15 border-amber-500/25 text-amber-200";
  return "bg-rose-500/20 border-rose-500/30 text-rose-200";
}

export default function ClassCognitiveHeatmap({ callAPI }: Props) {
  const [data, setData] = useState<SpecialtyStat[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAPI({ action: "class_analytics" });
      const list: SpecialtyStat[] = Array.isArray(res?.specialtyBreakdown) ? res.specialtyBreakdown : [];
      list.sort((a, b) => a.avg_score - b.avg_score);
      setData(list);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [callAPI]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <DadosInsuficientesCard
        title="Heatmap em construção"
        description="Assim que houver pontuações registradas em especialidades, o mapa coletivo aparecerá aqui."
        icon={<Layers className="h-4 w-4 text-primary/70" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Heatmap cognitivo da turma</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Especialidades ordenadas por fraqueza coletiva.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {data.map((s) => (
          <div
            key={s.specialty}
            className={cn(
              "rounded-xl border px-3 py-3 transition-transform hover:scale-[1.02]",
              colorFor(s.avg_score)
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 truncate">
              {s.specialty}
            </div>
            <div className="text-2xl font-black mt-1">{s.avg_score}%</div>
            <div className="text-[10px] opacity-70 mt-0.5">{s.student_count} aluno{s.student_count > 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-white/50">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" /> Crítico &lt;40</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Fraco 40-59</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" /> OK 60-74</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Bom 75+</span>
      </div>
    </div>
  );
}
