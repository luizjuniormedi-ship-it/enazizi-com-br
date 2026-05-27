import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Play, Pause, RefreshCw, Sparkles } from "lucide-react";

type DashboardData = {
  progress: any;
  control: any;
  cost_24h_usd: number;
  calls_24h: number;
  rejection_rate_24h: number;
};

export default function EnrichmentProgress() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pauseReason, setPauseReason] = useState("");
  const [samples, setSamples] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: d, error } = await supabase.rpc("enrichment_dashboard");
    if (error) toast.error(error.message);
    else setData(d as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const togglePause = async (paused: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_enrichment_paused", {
      _paused: paused,
      _reason: paused ? pauseReason || "manual" : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(paused ? "Esteira pausada" : "Esteira retomada");
    load();
  };

  const loadSamples = async () => {
    const { data: s, error } = await supabase.rpc("sample_enriched_questions", { _n: 20 });
    if (error) return toast.error(error.message);
    setSamples((s as any[]) || []);
  };

  const triggerTick = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("upgrade-questions", {
      body: { batch_size: 4, priority_filter: "auto", background: true },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tick disparado");
    setTimeout(load, 2000);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const p = data?.progress || {};
  const c = data?.control || {};
  const paused = !!c.is_paused;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Enriquecimento Global de Questões
          </h1>
          <p className="text-muted-foreground mt-1">
            Plano agressivo (gpt-4o-mini) · ~1.000 questões/dia · meta US$30–40
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Status da Esteira</CardTitle>
          <Badge variant={paused ? "destructive" : "default"}>
            {paused ? "PAUSADO" : "RODANDO"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {paused && c.pause_reason && (
            <div className="text-sm bg-destructive/10 text-destructive p-3 rounded">
              Motivo: {c.pause_reason}
            </div>
          )}
          {!paused && (
            <Textarea
              placeholder="Motivo da pausa (opcional)"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              rows={2}
            />
          )}
          <div className="flex gap-2 flex-wrap">
            {paused ? (
              <Button onClick={() => togglePause(false)} disabled={busy}>
                <Play className="h-4 w-4 mr-2" /> Retomar
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => togglePause(true)} disabled={busy}>
                <Pause className="h-4 w-4 mr-2" /> Pausar
              </Button>
            )}
            <Button variant="outline" onClick={triggerTick} disabled={busy || paused}>
              Disparar tick agora
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Último batch: {c.last_batch_at ? new Date(c.last_batch_at).toLocaleString("pt-BR") : "—"} ·
            Processadas hoje: {c.processed_today || 0}
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Fila restante" value={p.queue_remaining ?? "—"} />
        <Metric label="Enriquecidas 24h" value={p.enriched_24h ?? "—"} />
        <Metric label="Custo 24h (USD)" value={`$${(data?.cost_24h_usd ?? 0).toFixed(3)}`} />
        <Metric
          label="Rejeição 24h"
          value={`${data?.rejection_rate_24h ?? 0}%`}
          warn={(data?.rejection_rate_24h ?? 0) > 25}
        />
        <Metric label="Stem ≥ 400" value={`${p.pct_stem_ok ?? 0}%`} />
        <Metric label="Explicação ≥ 200" value={`${p.pct_expl_ok ?? 0}%`} />
        <Metric label="Com bibliografia" value={p.has_biblio ?? "—"} />
        <Metric label="Total GOLD" value={p.gold_total ?? "—"} />
      </div>

      {/* Amostragem */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Amostra (qualidade)</CardTitle>
          <Button size="sm" variant="outline" onClick={loadSamples}>
            Carregar 20 amostras
          </Button>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <p className="text-sm text-muted-foreground">Clique em "Carregar 20 amostras" para auditar.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {samples.map((s) => (
                <div key={s.id} className="border rounded p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.quality_tier === "GOLD" ? "default" : "secondary"}>
                      {s.quality_tier}
                    </Badge>
                    {s.is_clinical_case && <Badge variant="outline">caso clínico</Badge>}
                    {s.guideline_reference && (
                      <span className="text-xs text-muted-foreground">{s.guideline_reference}</span>
                    )}
                  </div>
                  <p className="line-clamp-3">{s.statement}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <Card className={warn ? "border-destructive" : ""}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
