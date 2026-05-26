/**
 * /admin/memory-health — Observatório Longitudinal da Memória Pedagógica (v23)
 *
 * KPIs: reuse, qualidade, drift, custo OpenAI evitado, segurança e orquestração.
 * Apenas admin (já protegido pela rota /admin).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain, Recycle, ShieldCheck, AlertTriangle, Activity, DollarSign,
  RefreshCw, TrendingDown, Database, Zap, Loader2
} from "lucide-react";
import { MetricCard } from "@/components/monitoring/MonitoringMetricCard";
import { Link } from "react-router-dom";

type Health = any;

export default function MemoryHealth() {
  const qc = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery<Health | null>({
    queryKey: ["memory-health-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("memory_health_dashboard" as any);
      if (error) throw error;
      return data as Health;
    },
    refetchInterval: 60_000,
  });

  const driftMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("memory_drift_analysis" as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => {
      toast.success(`Drift recalculado: ${r?.updated || 0} memórias, ${r?.quarantined || 0} quarentinadas`);
      qc.invalidateQueries({ queryKey: ["memory-health-dashboard"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao rodar drift analysis"),
  });

  const reuse = data?.reuse ?? {};
  const quality = data?.quality ?? {};
  const drift = data?.drift ?? {};
  const cost = data?.cost ?? {};
  const safety = data?.safety ?? {};
  const orch = data?.orchestration_24h ?? {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Memory Health Observatory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governança longitudinal da memória pedagógica IA — v23
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/memory-hallucinations">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Hallucination Forensics
            </Link>
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => driftMut.mutate()}
            disabled={driftMut.isPending}
          >
            {driftMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Rodar Drift Analysis
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando KPIs…</p>}

      {/* REUSE */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Recycle className="h-3 w-3" /> Reuse
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Database} label="Memórias totais" value={reuse.total_memories ?? 0} />
          <MetricCard icon={Recycle} label="Reutilizações" value={reuse.total_reuses ?? 0} />
          <MetricCard icon={ShieldCheck} label="Sucesso de reuse" value={`${reuse.success_rate ?? 0}%`} color="text-emerald-500" />
          <MetricCard icon={AlertTriangle} label="Falhas" value={reuse.reuse_failure ?? 0} color="text-destructive" />
        </div>
        {reuse.by_specialty && (
          <Card><CardHeader><CardTitle className="text-sm">Top especialidades reutilizadas</CardTitle></CardHeader>
            <CardContent><ul className="text-xs space-y-1">
              {reuse.by_specialty.map((s: any) => (
                <li key={s.specialty} className="flex justify-between border-b border-border/40 pb-1">
                  <span>{s.specialty}</span><span className="tabular-nums">{s.count} memórias · {s.reuses} reuses</span>
                </li>
              ))}
            </ul></CardContent>
          </Card>
        )}
      </section>

      {/* QUALITY */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quality & Promotion Funnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Brain} label="Quality médio" value={quality.avg_score ?? 0} />
          <MetricCard icon={ShieldCheck} label="Com bibliografia" value={quality.with_bibliography ?? 0} />
          <MetricCard icon={Brain} label="Profundidade pedagógica" value={quality.pedagogical_depth_avg ?? 0} />
          <MetricCard icon={ShieldCheck} label="Pureza linguística" value={quality.with_language_purity ?? 0} />
        </div>
        <Card><CardContent className="p-4 flex flex-wrap gap-2">
          {quality.promotion_funnel && Object.entries(quality.promotion_funnel).map(([k, v]) => (
            <Badge key={k} variant={k === "canonical" ? "default" : k === "quarantined" ? "destructive" : "secondary"}>
              {k}: {String(v)}
            </Badge>
          ))}
        </CardContent></Card>
      </section>

      {/* DRIFT */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <TrendingDown className="h-3 w-3" /> Drift & Decay
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={TrendingDown} label="Drift médio" value={drift.avg_drift ?? 0} color="text-amber-500" />
          <MetricCard icon={Activity} label="Decay médio" value={drift.avg_decay ?? 0} />
          <MetricCard icon={AlertTriangle} label="Stale (>90d)" value={drift.stale_count ?? 0} />
          <MetricCard icon={Recycle} label="Over-reused (>50)" value={drift.over_reused ?? 0} />
        </div>
        {drift.risk_levels && (
          <Card><CardContent className="p-4 flex flex-wrap gap-2">
            {Object.entries(drift.risk_levels).map(([k, v]) => (
              <Badge key={k} variant={k === "critical" ? "destructive" : k === "high" ? "default" : "outline"}>
                {k}: {String(v)}
              </Badge>
            ))}
          </CardContent></Card>
        )}
      </section>

      {/* COST */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-3 w-3" /> Cost (últimos 30d)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Zap} label="Exact hits" value={cost.last_30d_exact_hits ?? 0} color="text-emerald-500" />
          <MetricCard icon={Brain} label="Semantic hits" value={cost.last_30d_semantic_hits ?? 0} color="text-emerald-500" />
          <MetricCard icon={Activity} label="OpenAI calls" value={cost.last_30d_openai_calls ?? 0} />
          <MetricCard icon={DollarSign} label="Custo evitado" value={`US$ ${cost.last_30d_cost_saved_usd ?? 0}`} color="text-emerald-500" />
        </div>
        <p className="text-xs text-muted-foreground">Hit rate combinado: <strong>{cost.last_30d_hit_rate ?? 0}%</strong></p>
      </section>

      {/* SAFETY */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Safety</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard icon={AlertTriangle} label="Hallucination flagged" value={safety.hallucination_flagged ?? 0} color="text-destructive" />
          <MetricCard icon={ShieldCheck} label="Quarentinadas" value={safety.quarantined ?? 0} color="text-amber-500" />
          <MetricCard icon={Activity} label="Poisoning rate" value={`${safety.poisoning_rate ?? 0}%`} />
        </div>
      </section>

      {/* ORCHESTRATION */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Orchestration (24h)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Activity} label="Decisões" value={orch.total ?? 0} />
          <MetricCard icon={Zap} label="Latência média" value={`${orch.avg_latency_ms ?? 0}ms`} />
          <MetricCard icon={Brain} label="Lookup médio" value={`${orch.avg_lookup_ms ?? 0}ms`} />
          <MetricCard icon={Recycle} label="A/B comparações" value={orch.ab_comparisons ?? 0} />
        </div>
        {orch.by_action && (
          <Card><CardContent className="p-4 flex flex-wrap gap-2">
            {Object.entries(orch.by_action).map(([k, v]) => (
              <Badge key={k} variant="secondary">{k}: {String(v)}</Badge>
            ))}
          </CardContent></Card>
        )}
      </section>

      <p className="text-[10px] text-muted-foreground/60 text-right">
        Gerado em {data?.generated_at ? new Date(data.generated_at).toLocaleString("pt-BR") : "—"}
      </p>
    </div>
  );
}
