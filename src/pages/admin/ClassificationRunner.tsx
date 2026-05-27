/**
 * /admin/classification-runner
 * ────────────────────────────
 * Executor autenticado + auditor do classify-question-hierarchy.
 *
 * Recursos:
 *  - Diagnóstico forte de auth/admin/sessão
 *  - Execução via JWT da sessão atual (sem missing auth)
 *  - Persistência local (localStorage) + leitura da última run no banco
 *  - Histórico das últimas 10 runs
 *  - Resumo da fila de revisão (question_classification_queue)
 *  - Retry manual seguro + reexecutar último dry-run
 *  - Auditoria automática (verdict local) com regras:
 *      total_processed > 0, exact_text >= 80%, skipped < 10%
 *
 * Escopo estrito: NÃO altera a edge function nem rules/migrations.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Play,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  History,
  Database,
  Flame,
  Copy,
  Lock,
  TrendingUp,
  Activity,
  Wifi,
  HelpCircle,
  Heart,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  captureSnapshot,
  computeDelta,
  buildRollbackSql,
  loadPreSnapshot,
  loadPostSnapshot,
  savePreSnapshot,
  savePostSnapshot,
  type ClassificationSnapshot,
  type SnapshotDelta,
} from "@/lib/classificationSnapshot";

const STORAGE_KEY = "classification_runner:last_result";
const LAST_GOOD_DRY_RUN_KEY = "classification_runner:last_good_dry_run";
const DRY_RUN_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas
const CONFIRM_PHRASE = "EXECUTAR LOTE REAL";
const POLL_INTERVAL_MS = 5000;

type TableSource = "questions_bank" | "real_exam_questions";

interface MethodBreakdown {
  alias_exact?: number;
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

interface PersistedRun {
  id: string;
  table_source: string;
  batch_size: number;
  dry_run: boolean;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_processed: number | null;
  total_applied: number | null;
  total_queued_review: number | null;
  total_skipped: number | null;
  method_breakdown: MethodBreakdown | null;
  error_message: string | null;
}

interface QueueRow {
  id: string;
  question_id: string;
  original_topic: string | null;
  original_subtopic: string | null;
  classification_method: string | null;
  confidence_score: number | null;
  reason: string | null;
  status: string;
  created_at: string;
}

interface LocalSnapshot {
  result: RunResult;
  params: { table_source: TableSource; batch_size: number; dry_run: boolean };
  ts: string;
}

type Verdict = "healthy" | "borderline" | "rejected" | null;

type ErrorKind = "missing_auth" | "admin_only" | "network" | "server" | "timeout" | "unknown";

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function classifyError(message: string, raw: unknown): ErrorKind {
  const text = `${message} ${typeof raw === "string" ? raw : JSON.stringify(raw ?? "")}`.toLowerCase();
  if (text.includes("missing auth") || text.includes("jwt")) return "missing_auth";
  if (text.includes("admin only") || text.includes("403") || text.includes("forbidden")) return "admin_only";
  if (text.includes("failed to fetch") || text.includes("network")) return "network";
  if (text.includes("timeout") || text.includes("timed out")) return "timeout";
  if (text.includes("500") || text.includes("internal")) return "server";
  return "unknown";
}

function errorHint(kind: ErrorKind): string {
  switch (kind) {
    case "missing_auth":
      return "Sessão sem JWT válido. Saia e entre novamente como admin.";
    case "admin_only":
      return "Sua conta não tem role 'admin' em user_roles.";
    case "network":
      return "Falha de rede ao chamar a edge function.";
    case "timeout":
      return "Tempo de execução excedido. Tente reduzir o batch_size.";
    case "server":
      return "Erro 500 na edge function. Confira os logs.";
    default:
      return "Erro inesperado — confira o payload bruto abaixo.";
  }
}

function evaluate(result: RunResult | null) {
  if (!result || !result.total_processed) {
    return {
      verdict: null as Verdict,
      reasons: [] as string[],
      metrics: { exactPct: 0, aliasPct: 0, deterministicPct: 0, heuristicPct: 0, queuePct: 0, skipPct: 0, total: 0 },
    };
  }
  const total = result.total_processed ?? 0;
  const exact = result.method_breakdown?.exact_text ?? 0;
  const alias = result.method_breakdown?.alias_exact ?? 0;
  const heuristic = result.method_breakdown?.heuristic ?? 0;
  const skip = result.total_skipped ?? 0;
  const queue = result.total_queued_review ?? 0;
  const exactPct = pct(exact, total);
  const aliasPct = pct(alias, total);
  const deterministicPct = pct(exact + alias, total);
  const heuristicPct = pct(heuristic, total);
  const skipPct = pct(skip, total);
  const queuePct = pct(queue, total);

  const reasons: string[] = [];
  let verdict: Verdict = "healthy";

  if (total <= 0) {
    verdict = "rejected";
    reasons.push("total_processed = 0");
  }
  // Meta: exact_text + alias_exact >= 85% (alias-first layer)
  if (deterministicPct < 85) {
    if (deterministicPct >= 65) {
      verdict = verdict === "rejected" ? verdict : "borderline";
      reasons.push(`exact + alias ${deterministicPct}% (esperado ≥ 85%)`);
    } else {
      verdict = "rejected";
      reasons.push(`exact + alias ${deterministicPct}% muito baixo`);
    }
  }
  if (skipPct >= 5) {
    if (skipPct < 15) {
      verdict = verdict === "rejected" ? verdict : "borderline";
      reasons.push(`skipped ${skipPct}% (esperado < 5%)`);
    } else {
      verdict = "rejected";
      reasons.push(`skipped ${skipPct}% acima do limite`);
    }
  }
  if (queuePct > 10) {
    verdict = verdict === "rejected" ? verdict : "borderline";
    reasons.push(`fila de revisão ${queuePct}% (esperado < 10%)`);
  }

  if (verdict === "healthy") reasons.push("Distribuição dentro dos thresholds esperados");

  return { verdict, reasons, metrics: { exactPct, aliasPct, deterministicPct, heuristicPct, skipPct, queuePct, total } };
}

export default function ClassificationRunner() {
  const { user, session } = useAuth();
  const { roles, isAdmin, loading: rolesLoading } = useUserRoles();

  const [tableSource, setTableSource] = useState<TableSource>("questions_bank");
  const [batchSize, setBatchSize] = useState(100);
  const [dryRun, setDryRun] = useState(true);

  // Filtro created_after — bloqueia rodar no banco inteiro (Freeze v25)
  const todayMidnightLocal = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  })();
  const [createdAfter, setCreatedAfter] = useState<string>(todayMidnightLocal);
  const [overrideFullBank, setOverrideFullBank] = useState(false);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);

  const [running, setRunning] = useState(false);
  const [errorPayload, setErrorPayload] = useState<{ message: string; raw?: unknown } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [snapshotTs, setSnapshotTs] = useState<string | null>(null);

  const [lastRun, setLastRun] = useState<PersistedRun | null>(null);
  const [history, setHistory] = useState<PersistedRun[]>([]);
  const [queueStats, setQueueStats] = useState<{ pending: number; approved: number; rejected: number } | null>(null);
  const [queueItems, setQueueItems] = useState<QueueRow[]>([]);
  const [loadingPersisted, setLoadingPersisted] = useState(true);

  // Last good dry-run persistido (cache rápido)
  const [lastGoodDryRun, setLastGoodDryRun] = useState<{
    runId: string;
    verdict: Verdict;
    timestamp: string;
    tableSource: string;
    batchSize: number;
    metrics: { exactPct: number; aliasPct: number; deterministicPct: number; heuristicPct: number; queuePct: number; skipPct: number; total: number };
  } | null>(null);

  // Tester de conexão com a edge function
  const [connTesting, setConnTesting] = useState(false);
  const [connTest, setConnTest] = useState<{
    ok: boolean;
    latencyMs: number;
    summary: string;
    timestamp: string;
  } | null>(null);

  // ── Estado da execução real ────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [realRunning, setRealRunning] = useState(false);
  const [preSnapshot, setPreSnapshot] = useState<ClassificationSnapshot | null>(null);
  const [postSnapshot, setPostSnapshot] = useState<ClassificationSnapshot | null>(null);
  const [lastRealRunMeta, setLastRealRunMeta] = useState<{
    runId?: string | null;
    startedAt: string;
    finishedAt: string;
    tableSource: string;
    result: RunResult;
  } | null>(null);

  const ready = !!user && isAdmin && !rolesLoading && !!session;
  const evaluation = useMemo(() => evaluate(result), [result]);

  // ── Persistir "last good dry-run" sempre que verdict for healthy ─
  useEffect(() => {
    if (
      result &&
      result.dry_run &&
      evaluation.verdict === "healthy" &&
      result.run_id
    ) {
      const payload = {
        runId: result.run_id as string,
        verdict: evaluation.verdict,
        timestamp: snapshotTs ?? new Date().toISOString(),
        tableSource: (result.table_source as string) ?? tableSource,
        batchSize,
        metrics: evaluation.metrics,
      };
      try {
        localStorage.setItem(LAST_GOOD_DRY_RUN_KEY, JSON.stringify(payload));
        setLastGoodDryRun(payload);
      } catch {
        /* ignore */
      }
    }
  }, [result, evaluation, snapshotTs, tableSource, batchSize]);

  // ── Reidratar localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LocalSnapshot;
      if (parsed?.result) {
        setResult(parsed.result);
        setSnapshotTs(parsed.ts);
        if (parsed.params) {
          setTableSource(parsed.params.table_source);
          setBatchSize(parsed.params.batch_size);
          setDryRun(parsed.params.dry_run);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Buscar última run + histórico + queue ───────────────────────
  const fetchPersisted = useCallback(async () => {
    setLoadingPersisted(true);
    try {
      const [{ data: runs }, { data: queueAll }, { data: queuePending }] = await Promise.all([
        supabase
          .from("question_classification_runs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(10),
        supabase.from("question_classification_queue").select("status"),
        supabase
          .from("question_classification_queue")
          .select("*")
          .eq("status", "pending")
          .order("confidence_score", { ascending: true, nullsFirst: false })
          .limit(10),
      ]);

      const runsTyped = (runs ?? []) as PersistedRun[];
      setHistory(runsTyped);
      setLastRun(runsTyped[0] ?? null);

      const stats = { pending: 0, approved: 0, rejected: 0 };
      (queueAll ?? []).forEach((r: { status: string }) => {
        if (r.status === "pending") stats.pending++;
        else if (r.status === "approved") stats.approved++;
        else if (r.status === "rejected") stats.rejected++;
      });
      setQueueStats(stats);
      setQueueItems((queuePending ?? []) as QueueRow[]);
    } catch (e) {
      console.error("fetchPersisted error", e);
    } finally {
      setLoadingPersisted(false);
    }
  }, []);

  useEffect(() => {
    void fetchPersisted();
  }, [fetchPersisted]);

  // ── Hidratar last good dry-run do localStorage ─────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_GOOD_DRY_RUN_KEY);
      if (raw) setLastGoodDryRun(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // ── Auto-refresh enquanto houver run em andamento ──────────────
  useEffect(() => {
    if (!lastRun || lastRun.status !== "running") return;
    const id = window.setInterval(() => {
      void fetchPersisted();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [lastRun, fetchPersisted]);

  // ── Tester de conexão (dry-run mínimo, batch=10) ────────────────
  const testConnection = useCallback(async () => {
    if (!ready) {
      toast.error("Login admin necessário");
      return;
    }
    setConnTesting(true);
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("classify-question-hierarchy", {
        body: { table_source: tableSource, batch_size: 10, dry_run: true },
      });
      const latencyMs = Math.round(performance.now() - start);
      if (error) {
        setConnTest({
          ok: false,
          latencyMs,
          summary: error.message ?? "erro desconhecido",
          timestamp: new Date().toISOString(),
        });
        toast.error(`Conexão falhou (${latencyMs}ms)`);
        return;
      }
      const r = data as RunResult;
      setConnTest({
        ok: true,
        latencyMs,
        summary: `processed=${r.total_processed ?? 0} applied=${r.total_applied ?? 0} run=${(r.run_id as string | undefined)?.slice(0, 8) ?? "—"}`,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Conexão OK (${latencyMs}ms)`);
      void fetchPersisted();
    } catch (e) {
      const latencyMs = Math.round(performance.now() - start);
      setConnTest({
        ok: false,
        latencyMs,
        summary: (e as Error).message,
        timestamp: new Date().toISOString(),
      });
      toast.error("Falha de rede");
    } finally {
      setConnTesting(false);
    }
  }, [ready, tableSource, fetchPersisted]);

  // ── created_after helpers ───────────────────────────────────────
  const createdAfterIso = useMemo(() => {
    if (!createdAfter) return null;
    const d = new Date(createdAfter);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }, [createdAfter]);

  const refreshEligibleCount = useCallback(async () => {
    if (!createdAfterIso) {
      setEligibleCount(null);
      return;
    }
    setEligibleLoading(true);
    try {
      const { count } = await supabase
        .from(tableSource)
        .select("id", { count: "exact", head: true })
        .gte("created_at", createdAfterIso)
        .is("specialty_id", null);
      setEligibleCount(count ?? 0);
    } catch {
      setEligibleCount(null);
    } finally {
      setEligibleLoading(false);
    }
  }, [tableSource, createdAfterIso]);

  useEffect(() => {
    void refreshEligibleCount();
  }, [refreshEligibleCount]);

  // ── Execução ────────────────────────────────────────────────────
  const execute = useCallback(
    async (params: { table_source: TableSource; batch_size: number; dry_run: boolean; created_after?: string | null }) => {
      if (!ready) return;
      if (!params.created_after && !overrideFullBank) {
        toast.error("created_after vazio — bloqueado pelo Freeze v25. Defina a data ou ative o override.");
        return;
      }
      if (!params.created_after && overrideFullBank) {
        if (!confirm("⚠️ Você está prestes a classificar TODO o banco. Isso é bloqueado pelo Freeze v25. Continuar mesmo assim?")) return;
      }
      if (!params.dry_run && !confirm("dry_run está DESLIGADO. Vai ESCREVER no banco. Confirmar?")) return;

      setRunning(true);
      setErrorPayload(null);
      try {
        const body: Record<string, unknown> = {
          table_source: params.table_source,
          batch_size: Math.max(10, Math.min(500, params.batch_size)),
          dry_run: params.dry_run,
        };
        if (params.created_after) body.created_after = params.created_after;
        const { data, error } = await supabase.functions.invoke("classify-question-hierarchy", {
          body,
        });
        if (error) {
          setErrorPayload({ message: error.message, raw: data ?? error });
          toast.error("Edge function retornou erro");
          return;
        }
        const r = data as RunResult;
        setResult(r);
        const ts = new Date().toISOString();
        setSnapshotTs(ts);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ result: r, params, ts } satisfies LocalSnapshot),
          );
        } catch {
          /* ignore quota */
        }
        toast.success(params.dry_run ? "Dry-run concluído" : "Lote real concluído");
        void fetchPersisted();
        void refreshEligibleCount();
      } catch (e) {
        setErrorPayload({ message: (e as Error).message, raw: e });
        toast.error("Falha ao invocar edge function");
      } finally {
        setRunning(false);
      }
    },
    [ready, fetchPersisted, overrideFullBank, refreshEligibleCount],
  );

  const runWithCurrentParams = () =>
    execute({ table_source: tableSource, batch_size: batchSize, dry_run: dryRun, created_after: createdAfterIso });

  const runBatch500 = () =>
    execute({ table_source: tableSource, batch_size: 500, dry_run: false, created_after: createdAfterIso });

  const reRunLastDryRun = () => {
    if (!lastRun || !lastRun.dry_run) {
      toast.error("Nenhum dry-run anterior encontrado");
      return;
    }
    setTableSource(lastRun.table_source as TableSource);
    setBatchSize(lastRun.batch_size);
    setDryRun(true);
    void execute({
      table_source: lastRun.table_source as TableSource,
      batch_size: lastRun.batch_size,
      dry_run: true,
      created_after: createdAfterIso,
    });
  };

  const errorKind = errorPayload ? classifyError(errorPayload.message, errorPayload.raw) : null;

  // ── Reidratar snapshots persistidos ─────────────────────────────
  useEffect(() => {
    setPreSnapshot(loadPreSnapshot());
    setPostSnapshot(loadPostSnapshot());
  }, []);

  // ── GUARDRAILS para execução real ───────────────────────────────
  const lastDryRun = useMemo(
    () => history.find((r) => r.dry_run === true) ?? null,
    [history],
  );
  const lastDryRunVerdict = useMemo(() => {
    if (!lastDryRun) return null;
    return evaluate({
      total_processed: lastDryRun.total_processed ?? undefined,
      total_applied: lastDryRun.total_applied ?? undefined,
      total_queued_review: lastDryRun.total_queued_review ?? undefined,
      total_skipped: lastDryRun.total_skipped ?? undefined,
      method_breakdown: lastDryRun.method_breakdown ?? undefined,
    });
  }, [lastDryRun]);
  const dryRunAgeMs = lastDryRun
    ? Date.now() - new Date(lastDryRun.finished_at ?? lastDryRun.started_at).getTime()
    : Infinity;
  const dryRunFresh = dryRunAgeMs <= DRY_RUN_MAX_AGE_MS;
  const dryRunHealthy = lastDryRunVerdict?.verdict === "healthy";

  const guardrails = useMemo(() => {
    const checks: { ok: boolean; label: string }[] = [
      { ok: !!user, label: "Usuário logado" },
      { ok: isAdmin, label: "Role admin confirmada" },
      { ok: !!session?.access_token, label: "Sessão JWT presente" },
      { ok: !!lastDryRun, label: "Existe dry-run anterior" },
      { ok: !!lastDryRun && lastDryRun.dry_run === true, label: "Última run é dry-run válido" },
      { ok: dryRunHealthy, label: "Dry-run saudável (verdict=healthy)" },
      { ok: dryRunFresh, label: "Dry-run recente (≤ 2h)" },
    ];
    const passed = checks.every((c) => c.ok);
    return { checks, passed };
  }, [user, isAdmin, session, lastDryRun, dryRunHealthy, dryRunFresh]);

  const realParams = lastDryRun
    ? { table_source: lastDryRun.table_source as TableSource, batch_size: lastDryRun.batch_size }
    : null;

  // ── Executar lote real (com snapshots) ──────────────────────────
  const executeRealBatch = useCallback(async () => {
    if (!guardrails.passed || !realParams) {
      toast.error("Guardrails falharam — revise condições acima");
      return;
    }
    setRealRunning(true);
    setErrorPayload(null);
    const startedAt = new Date().toISOString();
    try {
      let pre: ClassificationSnapshot | null = null;
      try {
        pre = await captureSnapshot(realParams.table_source);
        savePreSnapshot(pre);
        setPreSnapshot(pre);
      } catch (e) {
        console.warn("Falha no snapshot pré-execução", e);
      }

      const realBody: Record<string, unknown> = {
        table_source: realParams.table_source,
        batch_size: realParams.batch_size,
        dry_run: false,
      };
      if (createdAfterIso) realBody.created_after = createdAfterIso;
      const { data, error } = await supabase.functions.invoke("classify-question-hierarchy", {
        body: realBody,
      });
      if (error) {
        setErrorPayload({ message: error.message, raw: data ?? error });
        toast.error("Lote real falhou");
        return;
      }
      const r = data as RunResult;
      setResult(r);
      const finishedAt = new Date().toISOString();
      setSnapshotTs(finishedAt);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            result: r,
            params: { ...realParams, dry_run: false },
            ts: finishedAt,
          } satisfies LocalSnapshot),
        );
      } catch {
        /* ignore */
      }

      try {
        const post = await captureSnapshot(realParams.table_source);
        savePostSnapshot(post);
        setPostSnapshot(post);
      } catch (e) {
        console.warn("Falha no snapshot pós-execução", e);
      }

      setLastRealRunMeta({
        runId: (r.run_id as string | undefined) ?? null,
        startedAt,
        finishedAt,
        tableSource: realParams.table_source,
        result: r,
      });

      toast.success(`Lote real concluído (${r.total_applied ?? 0} aplicadas)`);
      void fetchPersisted();
    } catch (e) {
      setErrorPayload({ message: (e as Error).message, raw: e });
      toast.error("Falha ao invocar edge function");
    } finally {
      setRealRunning(false);
      setConfirmOpen(false);
      setConfirmPhrase("");
    }
  }, [guardrails.passed, realParams, fetchPersisted, createdAfterIso]);

  const realRunsHistory = useMemo(() => history.filter((r) => !r.dry_run), [history]);

  const delta: SnapshotDelta | null = useMemo(() => {
    if (!preSnapshot || !postSnapshot) return null;
    return computeDelta(preSnapshot, postSnapshot);
  }, [preSnapshot, postSnapshot]);

  const coverage = useMemo(() => {
    if (!postSnapshot || !postSnapshot.total_questions) return null;
    const total = postSnapshot.total_questions;
    return {
      specialty: pct(postSnapshot.with_specialty_id, total),
      topic: pct(postSnapshot.with_topic_id, total),
      subtopic: pct(postSnapshot.with_subtopic_id, total),
    };
  }, [postSnapshot]);

  const rollbackSql = useMemo(() => {
    if (!lastRealRunMeta) return null;
    return buildRollbackSql({
      tableSource: lastRealRunMeta.tableSource,
      startedAt: lastRealRunMeta.startedAt,
      finishedAt: lastRealRunMeta.finishedAt,
      runId: lastRealRunMeta.runId,
    });
  }, [lastRealRunMeta]);

  const copyRollback = () => {
    if (!rollbackSql) return;
    navigator.clipboard
      .writeText(rollbackSql)
      .then(() => toast.success("SQL de rollback copiado"))
      .catch(() => toast.error("Não foi possível copiar"));
  };

  // ── Aviso de divergência local vs banco ─────────────────────────
  const divergence = useMemo(() => {
    if (!result || !lastRun) return false;
    if (!result.run_id) return false;
    return result.run_id !== lastRun.id;
  }, [result, lastRun]);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Executor autenticado do classificador</h1>
          <p className="text-muted-foreground text-sm">
            Dispara <code className="text-xs">classify-question-hierarchy</code> com o JWT da sua sessão. Auditoria
            automática + persistência + retry seguro.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPersisted} disabled={loadingPersisted}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingPersisted ? "animate-spin" : ""}`} />
          Atualizar status
        </Button>
      </div>

      <TooltipProvider>

      {/* ════════ Card Saúde da última execução ════════ */}
      <Card className={
        lastDryRunVerdict?.verdict === "healthy"
          ? "border-primary/50 bg-primary/5"
          : lastDryRunVerdict?.verdict === "borderline"
          ? "border-secondary bg-secondary/30"
          : lastDryRunVerdict?.verdict === "rejected"
          ? "border-destructive/50 bg-destructive/5"
          : ""
      }>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Saúde da última execução
            {lastRun?.status === "running" && (
              <Badge variant="secondary" className="ml-2">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> em andamento (auto-refresh)
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Resumo rápido da última run persistida + verdict local consolidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPersisted && !lastRun ? (
            <Skeleton className="h-24 w-full" />
          ) : !lastRun ? (
            <div className="space-y-3 text-sm">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma execução registrada ainda</AlertTitle>
                <AlertDescription>
                  Comece com um dry-run para validar o classificador antes de qualquer escrita.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={runWithCurrentParams} disabled={!ready || running}>
                  <Play className="h-4 w-4 mr-2" /> Abrir dry-run
                </Button>
                <Button size="sm" variant="outline" onClick={testConnection} disabled={!ready || connTesting}>
                  {connTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Testar conexão
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">run_id</div>
                  <div className="font-mono text-xs">{lastRun.id.slice(0, 8)}…</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">tabela</div>
                  <div className="text-xs">{lastRun.table_source}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">batch</div>
                  <div className="text-xs">{lastRun.batch_size}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">dry_run</div>
                  <div className="text-xs">{lastRun.dry_run ? "true" : "false"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">processed</div>
                  <div className="font-bold">{lastRun.total_processed ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">applied</div>
                  <div className="font-bold">{lastRun.total_applied ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">queued</div>
                  <div className="font-bold">{lastRun.total_queued_review ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">skipped</div>
                  <div className="font-bold">{lastRun.total_skipped ?? 0}</div>
                </div>
              </div>
              {lastDryRunVerdict && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">exact_text</div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.exactPct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">alias_exact</div>
                      <div className="font-bold text-primary">{lastDryRunVerdict.metrics.aliasPct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">heuristic</div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.heuristicPct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">queue %</div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.queuePct}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">skip %</div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.skipPct}%</div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {lastDryRunVerdict?.verdict === "healthy" && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> healthy
                  </Badge>
                )}
                {lastDryRunVerdict?.verdict === "borderline" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary">
                        ⚠️ borderline
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Dry-run abaixo do threshold ideal; revisar antes do lote real
                    </TooltipContent>
                  </Tooltip>
                )}
                {lastDryRunVerdict?.verdict === "rejected" && (
                  <Badge variant="destructive">❌ rejected</Badge>
                )}
                {lastGoodDryRun && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline">
                        Último dry-run saudável: {lastGoodDryRun.runId.slice(0, 8)}… ·{" "}
                        {new Date(lastGoodDryRun.timestamp).toLocaleString()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cache local: {lastGoodDryRun.tableSource} · batch {lastGoodDryRun.batchSize} ·
                      exact {lastGoodDryRun.metrics.exactPct}%
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico de autenticação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ready ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
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
            <span className="font-mono text-xs break-all">{user?.id ?? "—"}</span>
            <span className="text-muted-foreground">email:</span>
            <span>{user?.email ?? "—"}</span>
            <span className="text-muted-foreground">sessão (JWT):</span>
            <span>{session?.access_token ? "✅ presente" : "❌ ausente"}</span>
            <span className="text-muted-foreground">roles:</span>
            <span className="flex flex-wrap gap-1">
              {rolesLoading ? (
                "carregando…"
              ) : roles.length ? (
                roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))
              ) : (
                "nenhuma"
              )}
            </span>
            <span className="text-muted-foreground">isAdmin:</span>
            <span>{isAdmin ? "✅ true" : "❌ false"}</span>
          </div>
          <div className="pt-2">
            {ready ? (
              <Badge className="bg-primary text-primary-foreground">✅ pronto para executar</Badge>
            ) : !user ? (
              <Badge variant="destructive">❌ sem login</Badge>
            ) : !session ? (
              <Badge variant="destructive">❌ sessão inválida</Badge>
            ) : !isAdmin ? (
              <Badge variant="destructive">❌ sem role admin</Badge>
            ) : rolesLoading ? (
              <Badge variant="outline">verificando…</Badge>
            ) : (
              <Badge variant="destructive">❌ erro ao carregar roles</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Última run persistida */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Última run persistida (banco)
          </CardTitle>
          <CardDescription>Fonte oficial: question_classification_runs.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPersisted ? (
            <Skeleton className="h-24 w-full" />
          ) : !lastRun ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhuma run encontrada</AlertTitle>
              <AlertDescription>Execute um dry-run abaixo para gerar a primeira entrada.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">id</div>
                  <div className="font-mono text-xs break-all">{lastRun.id.slice(0, 8)}…</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">tabela</div>
                  <div>{lastRun.table_source}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">lote</div>
                  <div>{lastRun.batch_size}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">dry_run</div>
                  <div>
                    {lastRun.dry_run ? (
                      <Badge variant="secondary">true</Badge>
                    ) : (
                      <Badge variant="destructive">false</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">status</div>
                  <div>{lastRun.status}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">started_at</div>
                  <div className="text-xs">{new Date(lastRun.started_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">finished_at</div>
                  <div className="text-xs">
                    {lastRun.finished_at ? new Date(lastRun.finished_at).toLocaleString() : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">processadas</div>
                  <div>{lastRun.total_processed ?? 0}</div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">aplicadas</div>
                  <div>{lastRun.total_applied ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">para revisão</div>
                  <div>{lastRun.total_queued_review ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">skipped</div>
                  <div>{lastRun.total_skipped ?? 0}</div>
                </div>
              </div>
              {lastRun.method_breakdown && (
                <div>
                  <Label className="text-xs text-muted-foreground">method_breakdown</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(lastRun.method_breakdown).map(([k, v]) => (
                      <Badge key={k} variant="outline">
                        {k}: {String(v)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={reRunLastDryRun} disabled={!ready || running || !lastRun.dry_run}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reexecutar último dry-run
                </Button>
                {divergence && (
                  <Badge variant="secondary">⚠️ Resultado local difere da última run persistida</Badge>
                )}
              </div>
            </div>
          )}
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

          {/* created_after — Freeze v25 guard */}
          <div className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="space-y-2 sm:col-span-2">
              <Label>Classificar apenas questões criadas após</Label>
              <Input
                type="datetime-local"
                value={createdAfter}
                onChange={(e) => setCreatedAfter(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use para evitar classificar o banco inteiro. Padrão: hoje 00:00.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Elegíveis (sem specialty_id)</Label>
              <div className="h-10 flex items-center gap-2">
                {eligibleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-sm">
                    {eligibleCount ?? "—"} {createdAfterIso ? "desde a data" : "(banco inteiro)"}
                  </Badge>
                )}
                <Button size="sm" variant="ghost" onClick={refreshEligibleCount} disabled={eligibleLoading}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {!createdAfter && (
            <Alert variant="destructive">
              <Lock className="h-4 w-4" />
              <AlertTitle>Bloqueado pelo Freeze v25</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Sem <code>created_after</code> a execução roda contra o banco inteiro. Defina uma data
                  acima ou ative o override admin abaixo.
                </p>
                <div className="flex items-center gap-2">
                  <Switch checked={overrideFullBank} onCheckedChange={setOverrideFullBank} />
                  <span className="text-xs">
                    Override admin: permitir rodar no banco inteiro (sob sua responsabilidade)
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}


          {!dryRun && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Dry-run está desligado. Isso aplicará classificação real em <code>{tableSource}</code>.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={runWithCurrentParams} disabled={!ready || running} size="lg">
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
            {errorPayload && (
              <Button variant="outline" size="lg" onClick={runWithCurrentParams} disabled={!ready || running}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={testConnection}
              disabled={!ready || connTesting}
              title="Dispara dry-run mínimo (batch=10) só para medir latência e validar conectividade."
            >
              {connTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Testar conexão com edge function
            </Button>
          </div>

          {connTest && (
            <Alert variant={connTest.ok ? "default" : "destructive"}>
              <Activity className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                {connTest.ok ? "Conexão OK" : "Conexão falhou"}
                <Badge variant="outline">{connTest.latencyMs} ms</Badge>
                <span className="text-xs text-muted-foreground font-normal">
                  {new Date(connTest.timestamp).toLocaleTimeString()}
                </span>
              </AlertTitle>
              <AlertDescription className="font-mono text-xs break-all">
                {connTest.summary}
              </AlertDescription>
            </Alert>
          )}
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
              <AlertDescription>
                <div className="mb-1">
                  <Badge variant="outline" className="mr-2">
                    tipo: {errorKind}
                  </Badge>
                </div>
                {errorKind ? errorHint(errorKind) : ""}
              </AlertDescription>
            </Alert>
            <div>
              <Label className="text-xs text-muted-foreground">Payload bruto</Label>
              <pre className="mt-1 text-xs bg-muted p-3 rounded overflow-auto max-h-72">
                {typeof errorPayload.raw === "string"
                  ? errorPayload.raw
                  : JSON.stringify(errorPayload.raw, null, 2)}
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
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>Resumo da execução {snapshotTs && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    ({new Date(snapshotTs).toLocaleString()})
                  </span>
                )}</span>
                {evaluation.verdict === "healthy" && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Dry-run saudável
                  </Badge>
                )}
                {evaluation.verdict === "borderline" && (
                  <Badge variant="secondary">⚠️ Aprovado com cautela</Badge>
                )}
                {evaluation.verdict === "rejected" && <Badge variant="destructive">❌ Não aprovado</Badge>}
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

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center text-sm">
                <div>
                  <div className="font-semibold">{evaluation.metrics.exactPct}%</div>
                  <div className="text-xs text-muted-foreground">exact_text</div>
                </div>
                <div>
                  <div className="font-semibold text-primary">{evaluation.metrics.aliasPct}%</div>
                  <div className="text-xs text-muted-foreground">alias_exact</div>
                </div>
                <div>
                  <div className="font-semibold">{evaluation.metrics.heuristicPct}%</div>
                  <div className="text-xs text-muted-foreground">heuristic</div>
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
                  {result.method_breakdown ? (
                    Object.entries(result.method_breakdown).map(([k, v]) => (
                      <Badge key={k} variant="outline">
                        {k}: {v}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
                <CardTitle className="flex items-center gap-2">
                  Amostras ambíguas
                  <Badge variant="secondary">{result.sample_ambiguous.length}</Badge>
                  {snapshotTs && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(snapshotTs).toLocaleTimeString()}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Itens que cairiam na fila de revisão manual.</CardDescription>
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
              <CardDescription>Retorno completo da edge function (persistido localmente).</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[480px]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {/* ════════ EXECUÇÃO REAL (com guardrails) ════════ */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Flame className="h-5 w-5" />
            Execução real
          </CardTitle>
          <CardDescription>
            Aplica a classificação no banco. Só é liberado quando todos os guardrails passam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Operação irreversível sem rollback manual</AlertTitle>
            <AlertDescription>
              Esta ação grava <code>specialty_id / topic_id / subtopic_id</code> no banco e adiciona
              itens à fila de revisão. Use apenas após dry-run aprovado.
            </AlertDescription>
          </Alert>

          <div className="grid gap-2 text-sm">
            <div className="font-medium">Checklist de guardrails:</div>
            <ul className="space-y-1">
              {guardrails.checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-destructive" />
                  )}
                  <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {!lastDryRun && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhum dry-run válido encontrado</AlertTitle>
              <AlertDescription>Execute um dry-run primeiro.</AlertDescription>
            </Alert>
          )}
          {lastDryRun && !dryRunHealthy && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Último dry-run não atende critérios mínimos</AlertTitle>
              <AlertDescription>
                Veredito: <Badge variant="outline">{lastDryRunVerdict?.verdict ?? "—"}</Badge>
              </AlertDescription>
            </Alert>
          )}
          {lastDryRun && !dryRunFresh && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dry-run expirado — execute novamente</AlertTitle>
              <AlertDescription>
                Última execução há {Math.round(dryRunAgeMs / 60000)} min (limite 120 min).
              </AlertDescription>
            </Alert>
          )}

          {realParams && (
            <div className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded border bg-background">
              <div>
                <div className="text-xs text-muted-foreground">Tabela alvo</div>
                <div className="font-mono">{realParams.table_source}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Lote</div>
                <div>{realParams.batch_size}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dry-run referência</div>
                <div className="text-xs">
                  {lastDryRun ? new Date(lastDryRun.finished_at ?? lastDryRun.started_at).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          )}

          <Button
            variant="destructive"
            size="lg"
            disabled={!guardrails.passed || realRunning}
            onClick={() => setConfirmOpen(true)}
          >
            {realRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando…
              </>
            ) : (
              <>
                <Flame className="h-4 w-4 mr-2" />
                Executar primeiro lote real
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Modal de confirmação forte */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Flame className="h-5 w-5" /> Confirmar execução real
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Tabela:</span>
                  <span className="font-mono">{realParams?.table_source}</span>
                  <span className="text-muted-foreground">Batch:</span>
                  <span>{realParams?.batch_size}</span>
                  <span className="text-muted-foreground">Dry-run ref.:</span>
                  <span className="text-xs">
                    {lastDryRun
                      ? new Date(lastDryRun.finished_at ?? lastDryRun.started_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                {lastDryRunVerdict && (
                  <div className="grid grid-cols-4 gap-2 p-2 rounded border text-center text-xs">
                    <div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.total}</div>
                      <div className="text-muted-foreground">proc.</div>
                    </div>
                    <div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.exactPct}%</div>
                      <div className="text-muted-foreground">exact</div>
                    </div>
                    <div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.queuePct}%</div>
                      <div className="text-muted-foreground">fila</div>
                    </div>
                    <div>
                      <div className="font-bold">{lastDryRunVerdict.metrics.skipPct}%</div>
                      <div className="text-muted-foreground">skip</div>
                    </div>
                  </div>
                )}
                <div>
                  Verdict:{" "}
                  <Badge className="bg-primary text-primary-foreground">
                    {lastDryRunVerdict?.verdict ?? "—"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm-phrase" className="text-xs">
                    Para confirmar, digite: <code className="font-bold">{CONFIRM_PHRASE}</code>
                  </Label>
                  <Input
                    id="confirm-phrase"
                    value={confirmPhrase}
                    onChange={(e) => setConfirmPhrase(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={realRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmPhrase !== CONFIRM_PHRASE || realRunning}
              onClick={(e) => {
                e.preventDefault();
                void executeRealBatch();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {realRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando…
                </>
              ) : (
                <>Confirmar e executar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Impacto do lote real */}
      {lastRealRunMeta && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Impacto do lote real
            </CardTitle>
            <CardDescription>
              Run {lastRealRunMeta.runId?.slice(0, 8) ?? "—"} ·{" "}
              {new Date(lastRealRunMeta.startedAt).toLocaleString()} →{" "}
              {new Date(lastRealRunMeta.finishedAt).toLocaleTimeString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded border bg-background">
                <div className="text-2xl font-bold">{lastRealRunMeta.result.total_processed ?? 0}</div>
                <div className="text-xs text-muted-foreground">processadas</div>
              </div>
              <div className="p-3 rounded border bg-background">
                <div className="text-2xl font-bold">{lastRealRunMeta.result.total_applied ?? 0}</div>
                <div className="text-xs text-muted-foreground">aplicadas</div>
              </div>
              <div className="p-3 rounded border bg-background">
                <div className="text-2xl font-bold">{lastRealRunMeta.result.total_queued_review ?? 0}</div>
                <div className="text-xs text-muted-foreground">para revisão</div>
              </div>
              <div className="p-3 rounded border bg-background">
                <div className="text-2xl font-bold">{lastRealRunMeta.result.total_skipped ?? 0}</div>
                <div className="text-xs text-muted-foreground">skipped</div>
              </div>
            </div>
            {delta && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Delta no banco (snapshot antes vs depois)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm">
                    <Badge variant="outline">+{delta.specialty} specialty_id</Badge>
                    <Badge variant="outline">+{delta.topic} topic_id</Badge>
                    <Badge variant="outline">+{delta.subtopic} subtopic_id</Badge>
                    <Badge variant="outline">{delta.queue >= 0 ? "+" : ""}{delta.queue} queue</Badge>
                  </div>
                </div>
              </>
            )}
            {coverage && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Cobertura atual do banco</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-2 rounded border bg-background">
                      <div className="font-bold">{coverage.specialty}%</div>
                      <div className="text-xs text-muted-foreground">specialty_id</div>
                    </div>
                    <div className="p-2 rounded border bg-background">
                      <div className="font-bold">{coverage.topic}%</div>
                      <div className="text-xs text-muted-foreground">topic_id</div>
                    </div>
                    <div className="p-2 rounded border bg-background">
                      <div className="font-bold">{coverage.subtopic}%</div>
                      <div className="text-xs text-muted-foreground">subtopic_id</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rollback helper */}
      {rollbackSql && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Rollback helper
            </CardTitle>
            <CardDescription>
              SQL pronto para reverter o lote real. <strong>NÃO executa automaticamente.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={copyRollback}>
                <Copy className="h-4 w-4 mr-2" /> Copiar SQL
              </Button>
            </div>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-72">{rollbackSql}</pre>
          </CardContent>
        </Card>
      )}

      {/* Histórico de lotes reais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Últimos lotes reais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {realRunsHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lote real executado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>quando</TableHead>
                    <TableHead>tabela</TableHead>
                    <TableHead className="text-right">lote</TableHead>
                    <TableHead className="text-right">proc.</TableHead>
                    <TableHead className="text-right">apl.</TableHead>
                    <TableHead className="text-right">fila</TableHead>
                    <TableHead className="text-right">skip</TableHead>
                    <TableHead>verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realRunsHistory.map((r) => {
                    const v = evaluate({
                      total_processed: r.total_processed ?? undefined,
                      total_applied: r.total_applied ?? undefined,
                      total_queued_review: r.total_queued_review ?? undefined,
                      total_skipped: r.total_skipped ?? undefined,
                      method_breakdown: r.method_breakdown ?? undefined,
                    }).verdict;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          {new Date(r.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{r.table_source}</TableCell>
                        <TableCell className="text-right text-xs">{r.batch_size}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_processed ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_applied ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_queued_review ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_skipped ?? 0}</TableCell>
                        <TableCell className="text-xs">
                          {v === "healthy" && <Badge className="bg-primary text-primary-foreground">healthy</Badge>}
                          {v === "borderline" && <Badge variant="secondary">borderline</Badge>}
                          {v === "rejected" && <Badge variant="destructive">rejected</Badge>}
                          {!v && <Badge variant="outline">—</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Fila de revisão (question_classification_queue)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPersisted ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{queueStats?.pending ?? 0}</div>
                  <div className="text-xs text-muted-foreground">pendentes</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{queueStats?.approved ?? 0}</div>
                  <div className="text-xs text-muted-foreground">aprovadas</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-2xl font-bold">{queueStats?.rejected ?? 0}</div>
                  <div className="text-xs text-muted-foreground">rejeitadas</div>
                </div>
              </div>
              {queueItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>question_id</TableHead>
                        <TableHead>topic</TableHead>
                        <TableHead>subtopic</TableHead>
                        <TableHead>method</TableHead>
                        <TableHead>conf.</TableHead>
                        <TableHead>reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queueItems.map((q) => (
                        <TableRow key={q.id}>
                          <TableCell className="font-mono text-xs">{q.question_id.slice(0, 8)}…</TableCell>
                          <TableCell className="text-xs">{q.original_topic ?? "—"}</TableCell>
                          <TableCell className="text-xs">{q.original_subtopic ?? "—"}</TableCell>
                          <TableCell className="text-xs">{q.classification_method ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {typeof q.confidence_score === "number" ? q.confidence_score.toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{q.reason ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum item pendente na fila.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico recente (10 últimas runs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPersisted ? (
            <Skeleton className="h-32 w-full" />
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma run registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>quando</TableHead>
                    <TableHead>tabela</TableHead>
                    <TableHead>lote</TableHead>
                    <TableHead>dry</TableHead>
                    <TableHead>status</TableHead>
                    <TableHead className="text-right">proc.</TableHead>
                    <TableHead className="text-right">apl.</TableHead>
                    <TableHead className="text-right">fila</TableHead>
                    <TableHead className="text-right">skip</TableHead>
                    <TableHead>verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => {
                    const v = evaluate({
                      total_processed: r.total_processed ?? undefined,
                      total_applied: r.total_applied ?? undefined,
                      total_queued_review: r.total_queued_review ?? undefined,
                      total_skipped: r.total_skipped ?? undefined,
                      method_breakdown: r.method_breakdown ?? undefined,
                    }).verdict;
                    const rowClass =
                      v === "borderline"
                        ? "bg-secondary/40"
                        : v === "rejected"
                        ? "bg-destructive/10"
                        : "";
                    return (
                      <TableRow key={r.id} className={rowClass}>
                        <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{r.table_source}</TableCell>
                        <TableCell className="text-xs">{r.batch_size}</TableCell>
                        <TableCell className="text-xs">
                          {r.dry_run ? (
                            <Badge variant="secondary" className="text-xs">true</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">false</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{r.status}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_processed ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_applied ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_queued_review ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{r.total_skipped ?? 0}</TableCell>
                        <TableCell className="text-xs">
                          {v === "healthy" && (
                            <Badge className="bg-primary text-primary-foreground">healthy</Badge>
                          )}
                          {v === "borderline" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary">⚠️ borderline</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Dry-run abaixo do threshold ideal; revisar antes do lote real
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {v === "rejected" && <Badge variant="destructive">rejected</Badge>}
                          {!v && <Badge variant="outline">—</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      </TooltipProvider>
    </div>
  );
}
