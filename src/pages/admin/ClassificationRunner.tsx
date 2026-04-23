/**
 * /admin/classification-runner
 * ────────────────────────────
 * Executor autenticado do classificador hierárquico.
 * Dispara `classify-question-hierarchy` usando a sessão do navegador
 * (resolve o bloqueio de "missing auth" do ambiente server-side) e
 * audita o resultado bruto antes de qualquer execução real.
 *
 * Escopo estrito:
 *  - apenas dry-run (default true)
 *  - nenhuma alteração na edge function
 *  - nenhuma alteração no gerador / pipeline granular
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Play, ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type TableSource = "questions_bank" | "real_exam_questions";

interface MethodBreakdown {
  exact_text?: number;
  heuristic?: number;
  ai?: number;
  queued_review?: number;
  skipped?: number;
  [k: string]: number | undefined;
}

interface AmbiguousSample {
  question_id?: string;
  topic?: string | null;
  subtopic?: string | null;
  reason?: string | null;
  confidence?: number | null;
  suggested_specialty?: string | null;
  [k: string]: unknown;
}

interface RunResult {
  run_id?: string;
  table_source?: string;
  dry_run?: boolean;
  total_processed?: number;
  total_applied?: number;
  total_queued_review?: number;
  total_skipped?: number;
  method_breakdown?: MethodBreakdown;
  sample_ambiguous?: AmbiguousSample[];
  [k: string]: unknown;
}

type Verdict = "healthy" | "borderline" | "rejected" | null;

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function evaluate(result: RunResult | null): {
  verdict: Verdict;
  reasons: string[];
  metrics: { exactPct: number; skipPct: number; queuePct: number; total: number };
} {
  if (!result || !result.total_processed) {
    return { verdict: null, reasons: [], metrics: { exactPct: 0, skipPct: 0, queuePct: 0, total: 0 } };
  }
  const total = result.total_processed ?? 0;
  const exact = result.method_breakdown?.exact_text ?? 0;
  const skip = result.total_skipped ?? 0;
  const queue = result.total_queued_review ?? 0;
  const exactPct = pct(exact, total);
  const skipPct = pct(skip, total);
  const queuePct = pct(queue, total);

  const reasons: string[] = [];
  let verdict: Verdict = "healthy";

  if (total <= 0) {
    verdict = "rejected";
    reasons.push("total_processed = 0");
  }
  if (exactPct < 80) {
    if (exactPct >= 60) {
      verdict = verdict === "rejected" ? verdict : "borderline";
      reasons.push(`exact_text ${exactPct}% (esperado ≥ 80%)`);
    } else {
      verdict = "rejected";
      reasons.push(`exact_text ${exactPct}% muito baixo`);
    }
  }
  if (skipPct >= 10) {
    if (skipPct < 20) {
      verdict = verdict === "rejected" ? verdict : "borderline";
      reasons.push(`skipped ${skipPct}% (esperado < 10%)`);
    } else {
      verdict = "rejected";
      reasons.push(`skipped ${skipPct}% acima do limite`);
    }
  }
  if (queuePct > 30) {
    verdict = verdict === "rejected" ? verdict : "borderline";
    reasons.push(`fila de revisão ${queuePct}% (alta)`);
  }

  if (verdict === "healthy") reasons.push("Distribuição dentro dos thresholds esperados");

  return { verdict, reasons, metrics: { exactPct, skipPct, queuePct, total } };
}

export default function ClassificationRunner() {
  const { user } = useAuth();
  const { roles, isAdmin, loading: rolesLoading } = useUserRoles();

  const [tableSource, setTableSource] = useState<TableSource>("questions_bank");
  const [batchSize, setBatchSize] = useState(100);
  const [dryRun, setDryRun] = useState(true);

  const [running, setRunning] = useState(false);
  const [errorPayload, setErrorPayload] = useState<{ message: string; raw?: unknown } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const ready = !!user && isAdmin && !rolesLoading;
  const evaluation = useMemo(() => evaluate(result), [result]);

  const friendlyError = (err: unknown, raw?: unknown): { message: string; hint: string } => {
    const msg = (err as { message?: string })?.message || String(err);
    const text = (typeof raw === "string" ? raw : JSON.stringify(raw ?? "")).toLowerCase();
    if (text.includes("missing auth") || msg.toLowerCase().includes("missing auth")) {
      return { message: msg, hint: "Sessão sem JWT. Saia e entre novamente como admin." };
    }
    if (text.includes("admin only") || text.includes("403")) {
      return { message: msg, hint: "Sua conta não tem role 'admin' em user_roles." };
    }
    if (msg.includes("Failed to fetch") || msg.toLowerCase().includes("network")) {
      return { message: msg, hint: "Falha de rede ao chamar a edge function." };
    }
    return { message: msg, hint: "Erro inesperado — confira o payload bruto abaixo." };
  };

  async function runDryRun() {
    if (!ready) return;
    if (dryRun !== true && !confirm("dry_run está DESLIGADO. Vai ESCREVER no banco. Confirmar?")) {
      return;
    }
    setRunning(true);
    setErrorPayload(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("classify-question-hierarchy", {
        body: {
          table_source: tableSource,
          batch_size: Math.max(10, Math.min(500, batchSize)),
          dry_run: dryRun,
        },
      });
      if (error) {
        setErrorPayload({ message: error.message, raw: data ?? error });
        toast.error("Edge function retornou erro");
        return;
      }
      setResult(data as RunResult);
      toast.success(dryRun ? "Dry-run concluído" : "Lote real concluído");
    } catch (e) {
      setErrorPayload({ message: (e as Error).message, raw: e });
      toast.error("Falha ao invocar edge function");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Executor autenticado do classificador</h1>
        <p className="text-muted-foreground text-sm">
          Dispara <code className="text-xs">classify-question-hierarchy</code> com o JWT da sua sessão atual.
          Use para validar o dry-run antes de autorizar qualquer lote real.
        </p>
      </div>

      {/* Diagnóstico de autenticação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ready ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            Diagnóstico de autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Logado:</span>
            <span>{user ? "✅ sim" : "❌ não"}</span>
            <span className="text-muted-foreground">user.id:</span>
            <span className="font-mono text-xs">{user?.id ?? "—"}</span>
            <span className="text-muted-foreground">email:</span>
            <span>{user?.email ?? "—"}</span>
            <span className="text-muted-foreground">roles:</span>
            <span>
              {rolesLoading
                ? "carregando…"
                : roles.length
                  ? roles.map((r) => (
                      <Badge key={r} variant="secondary" className="mr-1">
                        {r}
                      </Badge>
                    ))
                  : "nenhuma"}
            </span>
            <span className="text-muted-foreground">isAdmin:</span>
            <span>{isAdmin ? "✅ true" : "❌ false"}</span>
          </div>
          <div className="pt-2">
            {ready ? (
              <Badge className="bg-primary text-primary-foreground">✅ pronto para executar</Badge>
            ) : !user ? (
              <Badge variant="destructive">❌ sem login</Badge>
            ) : !isAdmin ? (
              <Badge variant="destructive">❌ sem role admin</Badge>
            ) : (
              <Badge variant="outline">verificando…</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros</CardTitle>
          <CardDescription>
            Padrão seguro: <code>questions_bank</code>, lote 100, dry-run ligado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tabela alvo</Label>
              <Select value={tableSource} onValueChange={(v) => setTableSource(v as TableSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="questions_bank">questions_bank</SelectItem>
                  <SelectItem value="real_exam_questions">real_exam_questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho do lote</Label>
              <Input
                type="number"
                min={10}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value) || 100)}
              />
              <p className="text-xs text-muted-foreground">10–500</p>
            </div>
            <div className="space-y-2">
              <Label>Dry-run</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={dryRun} onCheckedChange={setDryRun} />
                <span className="text-sm">{dryRun ? "ligado (não escreve)" : "DESLIGADO (escreve!)"}</span>
              </div>
            </div>
          </div>

          {!dryRun && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Dry-run está desligado. Isso aplicará classificação real em <code>{tableSource}</code>.
              </AlertDescription>
            </Alert>
          )}

          <Button onClick={runDryRun} disabled={!ready || running} size="lg">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {dryRun ? "Executar dry-run" : "Executar lote real"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Erro */}
      {errorPayload && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro ao executar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert variant="destructive">
              <AlertTitle>{errorPayload.message}</AlertTitle>
              <AlertDescription>{friendlyError(errorPayload.message, errorPayload.raw).hint}</AlertDescription>
            </Alert>
            <div>
              <Label className="text-xs text-muted-foreground">Payload bruto</Label>
              <pre className="mt-1 text-xs bg-muted p-3 rounded overflow-auto max-h-72">
                {JSON.stringify(errorPayload.raw, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Resumo</span>
                {evaluation.verdict === "healthy" && (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Dry-run saudável
                  </Badge>
                )}
                {evaluation.verdict === "borderline" && (
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">
                    Aprovado com cautela
                  </Badge>
                )}
                {evaluation.verdict === "rejected" && (
                  <Badge variant="destructive">Não aprovado</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{result.total_processed ?? 0}</div>
                  <div className="text-xs text-muted-foreground">processadas</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{result.total_applied ?? 0}</div>
                  <div className="text-xs text-muted-foreground">aplicadas</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{result.total_queued_review ?? 0}</div>
                  <div className="text-xs text-muted-foreground">para revisão</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{result.total_skipped ?? 0}</div>
                  <div className="text-xs text-muted-foreground">skipped</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <div className="font-semibold">{evaluation.metrics.exactPct}%</div>
                  <div className="text-xs text-muted-foreground">exact_text</div>
                </div>
                <div>
                  <div className="font-semibold">{evaluation.metrics.queuePct}%</div>
                  <div className="text-xs text-muted-foreground">fila</div>
                </div>
                <div>
                  <div className="font-semibold">{evaluation.metrics.skipPct}%</div>
                  <div className="text-xs text-muted-foreground">skip</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">method_breakdown</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {result.method_breakdown
                    ? Object.entries(result.method_breakdown).map(([k, v]) => (
                        <Badge key={k} variant="outline">
                          {k}: {v}
                        </Badge>
                      ))
                    : <span className="text-xs text-muted-foreground">—</span>}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Decisão local</Label>
                <ul className="text-sm list-disc pl-5 mt-1">
                  {evaluation.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Amostras ambíguas */}
          {Array.isArray(result.sample_ambiguous) && result.sample_ambiguous.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Amostras ambíguas ({result.sample_ambiguous.length})</CardTitle>
                <CardDescription>
                  Itens que cairiam na fila de revisão manual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>question_id</TableHead>
                        <TableHead>topic</TableHead>
                        <TableHead>subtopic</TableHead>
                        <TableHead>sugerido</TableHead>
                        <TableHead>confidence</TableHead>
                        <TableHead>reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.sample_ambiguous.map((s, i) => (
                        <TableRow key={(s.question_id as string) ?? i}>
                          <TableCell className="font-mono text-xs">
                            {(s.question_id as string)?.slice(0, 8) ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">{s.topic ?? "—"}</TableCell>
                          <TableCell className="text-xs">{s.subtopic ?? "—"}</TableCell>
                          <TableCell className="text-xs">{s.suggested_specialty ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {typeof s.confidence === "number" ? s.confidence.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{s.reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* JSON bruto */}
          <Card>
            <CardHeader>
              <CardTitle>JSON bruto</CardTitle>
              <CardDescription>Retorno completo da edge function.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[480px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
