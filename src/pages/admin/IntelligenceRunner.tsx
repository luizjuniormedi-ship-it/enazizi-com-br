/**
 * /admin/intelligence-runner
 * ───────────────────────────
 * SPRINT INTEL-1 — FASE 2 (desbloqueio)
 *
 * Executor autenticado da edge `compute-intelligence-index` + auditor
 * direto da tabela `enamed_intelligence_index`. Permite comprovar a
 * conclusão da FASE 2 sem depender de DevTools/console.
 *
 * Escopo: apenas chamar a edge e ler a tabela. Não altera fórmula
 * nem inicia FASE 3 (UI `/admin/intelligence-index` continua bloqueada).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2, Database, Copy, Activity } from "lucide-react";
import { toast } from "sonner";

type RunResult = Record<string, unknown> & {
  success?: boolean;
  mode?: string;
  processed?: number;
  inserted?: number;
  updated?: number;
  with_score?: number;
  experimental_count?: number;
  null_score_count?: number;
  invalid_specialty_count?: number;
  invalid_subspecialty_count?: number;
  duplicate_key_count?: number;
  duration_ms?: number;
  tables_written?: string[];
  report?: {
    diagnostics?: Record<string, number>;
    [k: string]: unknown;
  };
};

interface AuditResult {
  total_rows_index: number;
  distribution_confidence: Record<string, number>;
  priority_score_min: number | null;
  priority_score_avg: number | null;
  priority_score_max: number | null;
  priority_score_null_count: number;
  fetched_at: string;
}

type Verdict = "GO" | "HOLD" | "FAIL";

function copyJson(obj: unknown) {
  try {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    toast.success("Copiado para a área de transferência.");
  } catch {
    toast.error("Falha ao copiar.");
  }
}

function evaluateVerdict(
  realRun: RunResult | null,
  audit: AuditResult | null,
): { verdict: Verdict; reasons: string[] } {
  if (!realRun) {
    return { verdict: "HOLD", reasons: ["real_run não executado"] };
  }
  const reasons: string[] = [];
  const tables = Array.isArray(realRun.tables_written) ? realRun.tables_written : [];
  const onlyExpectedTable =
    tables.length > 0 && tables.every((t) => t === "enamed_intelligence_index");
  if (tables.length > 0 && !onlyExpectedTable) {
    reasons.push(`escrita fora da tabela esperada: ${JSON.stringify(tables)}`);
    return { verdict: "FAIL", reasons };
  }

  if (realRun.success !== true) reasons.push("success != true");
  if ((realRun.duplicate_key_count ?? 0) > 0)
    reasons.push(`duplicate_key_count=${realRun.duplicate_key_count}`);
  if ((realRun.invalid_specialty_count ?? 0) > 0)
    reasons.push(`invalid_specialty_count=${realRun.invalid_specialty_count}`);
  if (audit && audit.priority_score_null_count > 0)
    reasons.push(`priority_score NULL em ${audit.priority_score_null_count} linhas`);
  if (!onlyExpectedTable && tables.length === 0)
    reasons.push("tables_written vazio — esperado ['enamed_intelligence_index']");

  if (reasons.length === 0) return { verdict: "GO", reasons: ["Todos os critérios GO atendidos."] };
  return { verdict: "FAIL", reasons };
}

export default function IntelligenceRunner() {
  const { user, session } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();

  const [dryRunning, setDryRunning] = useState(false);
  const [realRunning, setRealRunning] = useState(false);
  const [auditing, setAuditing] = useState(false);

  const [dryRunResult, setDryRunResult] = useState<RunResult | null>(null);
  const [realRunResult, setRealRunResult] = useState<RunResult | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [errorPayload, setErrorPayload] = useState<{ scope: string; message: string; raw?: unknown } | null>(null);

  const ready = !!user && isAdmin && !rolesLoading && !!session;

  const invoke = useCallback(async (dry: boolean) => {
    setErrorPayload(null);
    const scope = dry ? "dry_run" : "real_run";
    try {
      const { data, error } = await supabase.functions.invoke<RunResult>(
        "compute-intelligence-index",
        { body: { dry_run: dry, exam_key: "enamed" } },
      );
      if (error) {
        setErrorPayload({ scope, message: error.message ?? "erro desconhecido", raw: error });
        toast.error(`${scope} falhou: ${error.message ?? "erro"}`);
        return null;
      }
      toast.success(`${scope} concluído.`);
      return data ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorPayload({ scope, message: msg, raw: e });
      toast.error(`${scope} exceção: ${msg}`);
      return null;
    }
  }, []);

  const handleDryRun = useCallback(async () => {
    setDryRunning(true);
    const r = await invoke(true);
    if (r) setDryRunResult(r);
    setDryRunning(false);
  }, [invoke]);

  const handleRealRun = useCallback(async () => {
    setRealRunning(true);
    const r = await invoke(false);
    if (r) {
      setRealRunResult(r);
      // Auditoria automática após real-run
      void runAudit();
    }
    setRealRunning(false);
  }, [invoke]);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    try {
      const { data: rows, error } = await supabase
        .from("enamed_intelligence_index")
        .select("confidence_level, priority_score");
      if (error) {
        setErrorPayload({ scope: "audit", message: error.message, raw: error });
        toast.error(`Auditoria falhou: ${error.message}`);
        return;
      }
      const total = rows?.length ?? 0;
      const dist: Record<string, number> = {};
      let min: number | null = null;
      let max: number | null = null;
      let sum = 0;
      let nonNull = 0;
      let nulls = 0;
      for (const r of rows ?? []) {
        const cl = (r as any).confidence_level ?? "(null)";
        dist[cl] = (dist[cl] ?? 0) + 1;
        const ps = (r as any).priority_score;
        if (ps === null || ps === undefined) {
          nulls += 1;
        } else {
          const n = Number(ps);
          if (Number.isFinite(n)) {
            sum += n;
            nonNull += 1;
            if (min === null || n < min) min = n;
            if (max === null || n > max) max = n;
          }
        }
      }
      setAudit({
        total_rows_index: total,
        distribution_confidence: dist,
        priority_score_min: min,
        priority_score_avg: nonNull > 0 ? Math.round((sum / nonNull) * 10000) / 10000 : null,
        priority_score_max: max,
        priority_score_null_count: nulls,
        fetched_at: new Date().toISOString(),
      });
      toast.success("Auditoria concluída.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorPayload({ scope: "audit", message: msg, raw: e });
      toast.error(`Auditoria exceção: ${msg}`);
    } finally {
      setAuditing(false);
    }
  }, []);

  // Carrega contagem inicial
  useEffect(() => {
    if (ready && !audit) void runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const { verdict, reasons } = evaluateVerdict(realRunResult, audit);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Intelligence Runner — SPRINT INTEL-1 · FASE 2</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Executor autenticado de <code>compute-intelligence-index</code> + auditor de{" "}
          <code>enamed_intelligence_index</code>. Versão atual da fórmula:{" "}
          <Badge variant="outline">v0.3.1-historical-bootstrap</Badge>
        </p>
      </header>

      {/* Auth status */}
      {!ready ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso bloqueado</AlertTitle>
          <AlertDescription>
            {!user
              ? "Faça login para continuar."
              : rolesLoading
                ? "Verificando role…"
                : !isAdmin
                  ? "Sua conta não tem role admin."
                  : "Sessão indisponível."}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Sessão admin ativa</AlertTitle>
          <AlertDescription className="text-xs font-mono break-all">{user?.email}</AlertDescription>
        </Alert>
      )}

      {/* Action cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Dry Run</CardTitle>
            <CardDescription>Sem escrita. Valida diagnóstico e preview.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDryRun} disabled={!ready || dryRunning} className="w-full">
              {dryRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Dry Run
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Real Run</CardTitle>
            <CardDescription>Grava em <code>enamed_intelligence_index</code>.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRealRun}
              disabled={!ready || realRunning}
              className="w-full"
              variant="default"
            >
              {realRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Real Run
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Auditoria</CardTitle>
            <CardDescription>Lê tabela e calcula estatísticas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runAudit} disabled={!ready || auditing} className="w-full" variant="secondary">
              {auditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Auditar Índice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {errorPayload && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro em {errorPayload.scope}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">{errorPayload.message}</p>
            <pre className="text-xs bg-background/40 p-2 rounded overflow-x-auto max-h-48">
              {JSON.stringify(errorPayload.raw, null, 2)}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {/* Veredito */}
      {realRunResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verdict === "GO" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : verdict === "FAIL" ? (
                <ShieldAlert className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Veredito FASE 2:{" "}
              <Badge
                variant={verdict === "GO" ? "default" : verdict === "FAIL" ? "destructive" : "outline"}
              >
                {verdict}
              </Badge>
            </CardTitle>
            <CardDescription>
              Critérios: success=true · duplicate_key_count=0 · invalid_specialty_count=0 ·
              priority_score_null_count=0 · tables_written=["enamed_intelligence_index"]
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="font-mono">• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      <div className="grid gap-4 lg:grid-cols-2">
        {dryRunResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Dry Run — JSON</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copyJson(dryRunResult)}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto max-h-[600px]">
                {JSON.stringify(dryRunResult, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {realRunResult && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Real Run — JSON</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => copyJson(realRunResult)}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto max-h-[600px]">
                {JSON.stringify(realRunResult, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Relatório consolidado */}
      {(realRunResult || audit) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Relatório consolidado FASE 2</CardTitle>
            {audit && (
              <Button size="sm" variant="ghost" onClick={() => copyJson({ realRunResult, audit, verdict, reasons })}>
                <Copy className="h-3 w-3 mr-1" /> Copiar relatório
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto whitespace-pre">
{`STATUS

processed                       ${realRunResult?.processed ?? "—"}
inserted                        ${realRunResult?.inserted ?? "—"}
updated                         ${realRunResult?.updated ?? "—"}

with_score                      ${realRunResult?.with_score ?? "—"}
experimental_count              ${realRunResult?.experimental_count ?? "—"}

attempts_found                  ${(realRunResult?.report as any)?.diagnostics?.attempts_found ?? "—"}
fsrs_cards_found                ${(realRunResult?.report as any)?.diagnostics?.fsrs_cards_found ?? "—"}

invalid_specialty_count         ${realRunResult?.invalid_specialty_count ?? "—"}
invalid_subspecialty_count      ${realRunResult?.invalid_subspecialty_count ?? "—"}

duplicate_key_count             ${realRunResult?.duplicate_key_count ?? "—"}

duration_ms                     ${realRunResult?.duration_ms ?? "—"}

tables_written                  ${JSON.stringify(realRunResult?.tables_written ?? [])}

total_rows_index                ${audit?.total_rows_index ?? "—"}

distribution_confidence         ${audit ? JSON.stringify(audit.distribution_confidence) : "—"}

priority_score_min              ${audit?.priority_score_min ?? "—"}
priority_score_avg              ${audit?.priority_score_avg ?? "—"}
priority_score_max              ${audit?.priority_score_max ?? "—"}

priority_score_null_count       ${audit?.priority_score_null_count ?? "—"}

────────────────────────────────────────
DECISION                        ${verdict}
${reasons.map((r) => `  • ${r}`).join("\n")}`}
            </pre>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              FASE 3 (<code>/admin/intelligence-index</code>) permanece bloqueada até aprovação humana
              do veredito acima.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
