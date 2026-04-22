import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Activity, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RunRow {
  id: string;
  endpoint: string;
  pipeline_used: "granular" | "legacy";
  banca: string | null;
  banca_status: string | null;
  requested_count: number | null;
  generated_count: number | null;
  fallback_triggered: boolean;
  fallback_reason: string | null;
  duration_ms: number | null;
  status: "success" | "fallback" | "error";
  error_message: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  granular: number;
  legacy: number;
  fallbacks: number;
  errors: number;
  avgDuration: number;
}

const FLAG_KEY = "granular_generator_enabled";

export default function GranularGeneratorMonitor() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [flagOn, setFlagOn] = useState(false);
  const [flagSaving, setFlagSaving] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, granular: 0, legacy: 0, fallbacks: 0, errors: 0, avgDuration: 0,
  });

  const loadFlag = async () => {
    const { data } = await supabase
      .from("system_flags")
      .select("enabled")
      .eq("flag_key", FLAG_KEY)
      .maybeSingle();
    setFlagOn(Boolean(data?.enabled));
  };

  const loadRuns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("granular_generator_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Falha ao carregar runs", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as RunRow[];
    setRuns(rows);

    const total = rows.length;
    const granular = rows.filter(r => r.pipeline_used === "granular").length;
    const legacy = rows.filter(r => r.pipeline_used === "legacy").length;
    const fallbacks = rows.filter(r => r.fallback_triggered).length;
    const errors = rows.filter(r => r.status === "error").length;
    const durations = rows.map(r => r.duration_ms ?? 0).filter(Boolean);
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    setStats({ total, granular, legacy, fallbacks, errors, avgDuration });
    setLoading(false);
  };

  useEffect(() => {
    loadFlag();
    loadRuns();
  }, []);

  const toggleFlag = async (next: boolean) => {
    setFlagSaving(true);
    const { error } = await supabase
      .from("system_flags")
      .update({ enabled: next, updated_at: new Date().toISOString() })
      .eq("flag_key", FLAG_KEY);
    setFlagSaving(false);
    if (error) {
      toast({ title: "Falha ao salvar flag", description: error.message, variant: "destructive" });
      return;
    }
    setFlagOn(next);
    toast({
      title: next ? "Gerador granular LIGADO" : "Gerador granular DESLIGADO",
      description: next
        ? "Apenas bancas com status 'pronta' serão atendidas. Demais caem no fallback."
        : "Todas as requisições voltam ao gerador atual (legacy).",
    });
  };

  const statusBadge = (s: RunRow["status"]) => {
    if (s === "success") return <Badge variant="default" className="gap-1"><CheckCircle2 className="w-3 h-3" />sucesso</Badge>;
    if (s === "fallback") return <Badge variant="secondary" className="gap-1"><ShieldAlert className="w-3 h-3" />fallback</Badge>;
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />erro</Badge>;
  };

  const pipelineBadge = (p: RunRow["pipeline_used"]) =>
    p === "granular"
      ? <Badge className="bg-primary/15 text-primary hover:bg-primary/20">granular</Badge>
      : <Badge variant="outline">legacy</Badge>;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Sprint 4 — Gerador Granular
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pipeline novo opera apenas com flag LIGADA + banca status <b>pronta</b>.
            Tudo o mais cai no gerador atual automaticamente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRuns} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Recarregar</span>
        </Button>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Feature flag</CardTitle>
          <CardDescription>
            Rollback rápido: desligue para reverter 100% do tráfego ao gerador atual no próximo request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="flag"
              checked={flagOn}
              onCheckedChange={toggleFlag}
              disabled={flagSaving}
            />
            <Label htmlFor="flag" className="font-mono text-sm">
              granular_generator_enabled = <b>{flagOn ? "true" : "false"}</b>
            </Label>
            {flagSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total runs" value={stats.total} />
        <StatCard label="Granular" value={stats.granular} accent="primary" />
        <StatCard label="Legacy" value={stats.legacy} />
        <StatCard label="Fallbacks" value={stats.fallbacks} accent="warning" />
        <StatCard label="Erros" value={stats.errors} accent="destructive" />
        <StatCard label="Tempo médio" value={`${stats.avgDuration} ms`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas 50 execuções</CardTitle>
          <CardDescription>Ordem decrescente por data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma execução registrada ainda. Gere um simulado para começar a popular esta tabela.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Gerado</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo fallback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.endpoint}</TableCell>
                      <TableCell>{pipelineBadge(r.pipeline_used)}</TableCell>
                      <TableCell className="text-xs">
                        {r.banca ?? "—"}
                        {r.banca_status && (
                          <span className="ml-2 text-muted-foreground">({r.banca_status})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{r.requested_count ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">{r.generated_count ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs">{r.duration_ms ?? "—"}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate" title={r.fallback_reason ?? r.error_message ?? ""}>
                        {r.fallback_reason ?? r.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "primary" | "warning" | "destructive";
}) {
  const cls =
    accent === "primary" ? "text-primary"
    : accent === "warning" ? "text-amber-600"
    : accent === "destructive" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
