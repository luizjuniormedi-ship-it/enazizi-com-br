/**
 * ExpandedTestRunner — roda 4 cenários clínicos em sequência.
 *
 * Para cada cenário:
 *  1. ensureSeed (cria/atualiza memória global com quality 85).
 *  2. Embedder com retryFailed=true (limit 25).
 *  3. Para cada variante, chama tutor-memory-search e verifica se o seed
 *     foi recuperado (top hit com id correto OU similarity acima do
 *     threshold permissivo).
 *
 * Critério:
 *  - cenário aprovado se ≥ 75% variantes recuperaram
 *  - sprint aprovada se média geral ≥ 80%
 *
 * Sem perguntas manuais. Não interfere no Tutor.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Beaker,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Copy,
} from "lucide-react";
import {
  SCENARIOS,
  type Scenario,
  VARIANT_PASS_RATE,
  SPRINT_PASS_RATE,
  SIMILARITY_THRESHOLD,
  MIN_QUALITY,
} from "./scenarios";

interface VariantResult {
  question: string;
  matched: boolean;
  similarity: number | null;
  hybridScore: number | null;
  memoryId: string | null;
  qualityScore: number | null;
  error?: string;
}

interface ScenarioResult {
  id: Scenario["id"];
  label: string;
  emoji: string;
  seedAction: "found" | "created" | "error";
  seedId: string | null;
  seedError?: string;
  embedder: { succeeded: number; failed: number; skipped: number } | null;
  embedderError?: string;
  variants: VariantResult[];
  passRate: number;
  approved: boolean;
}

interface SprintReport {
  startedAt: string;
  finishedAt: string;
  scenarios: ScenarioResult[];
  approvedCount: number;
  totalCount: number;
  variantsRecovered: number;
  variantsTotal: number;
  avgSemantic: number | null;
  avgHybrid: number | null;
  bestId: Scenario["id"] | null;
  worstId: Scenario["id"] | null;
  approved: boolean;
}

async function ensureSeed(scenario: Scenario): Promise<{
  action: "found" | "created" | "error";
  id: string | null;
  error?: string;
}> {
  const { seed } = scenario;
  const { data: existing, error: findErr } = await supabase
    .from("tutor_knowledge_memory")
    .select("id, quality_score")
    .eq("scope", "global")
    .eq("question_normalized", seed.questionNormalized)
    .limit(1)
    .maybeSingle();

  if (findErr) return { action: "error", id: null, error: findErr.message };
  if (existing?.id) {
    if ((existing.quality_score ?? 0) < MIN_QUALITY) {
      await supabase
        .from("tutor_knowledge_memory")
        .update({ quality_score: 85 })
        .eq("id", existing.id);
    }
    return { action: "found", id: existing.id };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("tutor_knowledge_memory")
    .insert({
      scope: "global",
      user_id: null,
      question_original: seed.questionOriginal,
      question_normalized: seed.questionNormalized,
      topic: seed.topic,
      subtopic: seed.subtopic,
      specialty: seed.specialty,
      answer_summary: seed.answerSummary,
      blocks: seed.blocks as unknown as never,
      block_types: seed.blocks.map((b) => b.type),
      quality_score: 85,
      source: "seed_admin_test_expanded",
      embedding_status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return {
      action: "error",
      id: null,
      error: insErr?.message ?? "insert returned no row",
    };
  }
  return { action: "created", id: inserted.id };
}

async function runEmbedder(): Promise<{
  result: { succeeded: number; failed: number; skipped: number } | null;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke(
    "tutor-memory-embedder",
    { body: { limit: 25, retryFailed: true } },
  );
  if (error) return { result: null, error: error.message };
  return {
    result: {
      succeeded: data?.succeeded ?? 0,
      failed: data?.failed ?? 0,
      skipped: data?.skipped ?? 0,
    },
  };
}

async function searchVariant(
  scenario: Scenario,
  question: string,
  seedId: string | null,
): Promise<VariantResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "tutor-memory-search",
      {
        body: {
          text: question,
          matchCount: 8,
          topic: scenario.seed.topic,
          subtopic: scenario.seed.subtopic,
        },
      },
    );
    if (error) {
      return {
        question,
        matched: false,
        similarity: null,
        hybridScore: null,
        memoryId: null,
        qualityScore: null,
        error: error.message,
      };
    }
    const hits = (data?.hits ?? []) as Array<{
      id: string;
      similarity: number;
      hybrid_score?: number;
      quality_score: number;
    }>;
    if (hits.length === 0) {
      return {
        question,
        matched: false,
        similarity: null,
        hybridScore: null,
        memoryId: null,
        qualityScore: null,
      };
    }
    // Match: seed específico OU top hit com similarity razoável + qualidade ok
    const seedHit = seedId ? hits.find((h) => h.id === seedId) : null;
    const top = seedHit ?? hits[0];
    const matched =
      (!!seedHit ||
        (top.similarity >= SIMILARITY_THRESHOLD &&
          top.quality_score >= MIN_QUALITY)) &&
      top.quality_score >= MIN_QUALITY;
    return {
      question,
      matched,
      similarity: top.similarity,
      hybridScore: top.hybrid_score ?? null,
      memoryId: top.id,
      qualityScore: top.quality_score,
    };
  } catch (err) {
    return {
      question,
      matched: false,
      similarity: null,
      hybridScore: null,
      memoryId: null,
      qualityScore: null,
      error: err instanceof Error ? err.message : "erro desconhecido",
    };
  }
}

export function ExpandedTestRunner({
  onCompleted,
}: {
  onCompleted?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<SprintReport | null>(null);

  const runAll = async () => {
    setRunning(true);
    setReport(null);
    const startedAt = new Date().toISOString();
    const scenarios: ScenarioResult[] = [];

    try {
      for (let i = 0; i < SCENARIOS.length; i++) {
        const sc = SCENARIOS[i];
        setProgress(Math.round(((i + 0.1) / SCENARIOS.length) * 100));
        toast.info(`${sc.emoji} ${sc.label}`);

        // Seed
        // eslint-disable-next-line no-await-in-loop
        const seed = await ensureSeed(sc);
        // Embedder
        // eslint-disable-next-line no-await-in-loop
        const emb = await runEmbedder();

        // Variantes (sequencial p/ não estressar edge)
        const variants: VariantResult[] = [];
        for (const q of sc.variants) {
          // eslint-disable-next-line no-await-in-loop
          const v = await searchVariant(sc, q, seed.id);
          variants.push(v);
        }

        const matched = variants.filter((v) => v.matched).length;
        const passRate = variants.length > 0 ? matched / variants.length : 0;
        const approved = passRate >= VARIANT_PASS_RATE && seed.action !== "error";

        scenarios.push({
          id: sc.id,
          label: sc.label,
          emoji: sc.emoji,
          seedAction: seed.action,
          seedId: seed.id,
          seedError: seed.error,
          embedder: emb.result,
          embedderError: emb.error,
          variants,
          passRate,
          approved,
        });

        setProgress(Math.round(((i + 1) / SCENARIOS.length) * 100));
      }

      const variantsTotal = scenarios.reduce(
        (acc, s) => acc + s.variants.length,
        0,
      );
      const variantsRecovered = scenarios.reduce(
        (acc, s) => acc + s.variants.filter((v) => v.matched).length,
        0,
      );
      const allSem = scenarios
        .flatMap((s) => s.variants.map((v) => v.similarity))
        .filter((s): s is number => typeof s === "number");
      const allHyb = scenarios
        .flatMap((s) => s.variants.map((v) => v.hybridScore))
        .filter((s): s is number => typeof s === "number");
      const avgSem =
        allSem.length > 0 ? allSem.reduce((a, b) => a + b, 0) / allSem.length : null;
      const avgHyb =
        allHyb.length > 0 ? allHyb.reduce((a, b) => a + b, 0) / allHyb.length : null;

      const sortedByRate = [...scenarios].sort((a, b) => b.passRate - a.passRate);
      const bestId = sortedByRate[0]?.id ?? null;
      const worstId = sortedByRate[sortedByRate.length - 1]?.id ?? null;

      const overall = variantsTotal > 0 ? variantsRecovered / variantsTotal : 0;
      const approved = overall >= SPRINT_PASS_RATE;

      const r: SprintReport = {
        startedAt,
        finishedAt: new Date().toISOString(),
        scenarios,
        approvedCount: scenarios.filter((s) => s.approved).length,
        totalCount: scenarios.length,
        variantsRecovered,
        variantsTotal,
        avgSemantic: avgSem,
        avgHybrid: avgHyb,
        bestId,
        worstId,
        approved,
      };
      setReport(r);

      if (approved) {
        toast.success(
          `✅ Sprint aprovada · ${variantsRecovered}/${variantsTotal} variantes`,
        );
      } else {
        toast.error(
          `❌ Sprint reprovada · ${variantsRecovered}/${variantsTotal} variantes`,
        );
      }
      onCompleted?.();
    } finally {
      setRunning(false);
      setProgress(100);
    }
  };

  const reportText = useMemo(() => {
    if (!report) return "";
    const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);
    const lines: string[] = [];
    lines.push("# Relatório do Test Runner Semântico");
    lines.push("");
    lines.push(`Início: ${report.startedAt}`);
    lines.push(`Fim: ${report.finishedAt}`);
    lines.push("");
    lines.push(
      `Taxa geral: ${pct(report.variantsRecovered / Math.max(1, report.variantsTotal))} (${report.variantsRecovered}/${report.variantsTotal})`,
    );
    lines.push(
      `Cenários aprovados: ${report.approvedCount}/${report.totalCount}`,
    );
    lines.push(`Semantic médio: ${pct(report.avgSemantic)}`);
    lines.push(`Hybrid médio: ${pct(report.avgHybrid)}`);
    lines.push(`Melhor cenário: ${report.bestId ?? "—"}`);
    lines.push(`Pior cenário: ${report.worstId ?? "—"}`);
    lines.push(`Veredito: ${report.approved ? "APROVADO" : "REPROVADO"}`);
    lines.push("");
    for (const s of report.scenarios) {
      lines.push(`## ${s.emoji} ${s.label}`);
      lines.push(
        `Seed: ${s.seedAction}${s.seedError ? ` (${s.seedError})` : ""}`,
      );
      if (s.embedder) {
        lines.push(
          `Embedder: ${s.embedder.succeeded} ok, ${s.embedder.failed} fail, ${s.embedder.skipped} skip`,
        );
      }
      lines.push(`Pass rate: ${pct(s.passRate)} (${s.approved ? "OK" : "FAIL"})`);
      for (const v of s.variants) {
        lines.push(
          `  - ${v.matched ? "✓" : "✗"} "${v.question}" — sim ${pct(v.similarity)} hyb ${pct(v.hybridScore)}`,
        );
      }
      lines.push("");
    }
    return lines.join("\n");
  }, [report]);

  const copyReport = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success("Relatório copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Beaker className="h-4 w-4 text-primary" />
              Test Runner expandido (4 cenários)
            </CardTitle>
            <CardDescription>
              Cardio · Pneumo · Neuro · Hemato. Cria seeds, processa
              embeddings e valida variantes semanticamente próximas.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={runAll}
              disabled={running}
              className="gap-2"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Rodar 4 cenários
            </Button>
            {report && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyReport}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copiar relatório
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {running && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Executando…</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {report && (
          <>
            {/* Veredito global */}
            <div
              className={`flex items-start gap-3 p-3 rounded-md border ${
                report.approved
                  ? "border-success/30 bg-success/5"
                  : "border-destructive/30 bg-destructive/5"
              }`}
            >
              {report.approved ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {report.approved ? "SPRINT APROVADA" : "SPRINT REPROVADA"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Taxa geral{" "}
                  <strong>
                    {(
                      (report.variantsRecovered /
                        Math.max(1, report.variantsTotal)) *
                      100
                    ).toFixed(1)}
                    %
                  </strong>{" "}
                  · Cenários aprovados{" "}
                  <strong>
                    {report.approvedCount}/{report.totalCount}
                  </strong>{" "}
                  · Variantes{" "}
                  <strong>
                    {report.variantsRecovered}/{report.variantsTotal}
                  </strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Semantic médio{" "}
                  <strong>
                    {report.avgSemantic != null
                      ? `${(report.avgSemantic * 100).toFixed(1)}%`
                      : "—"}
                  </strong>{" "}
                  · Hybrid médio{" "}
                  <strong>
                    {report.avgHybrid != null
                      ? `${(report.avgHybrid * 100).toFixed(1)}%`
                      : "—"}
                  </strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Melhor: <strong>{report.bestId ?? "—"}</strong> · Pior:{" "}
                  <strong>{report.worstId ?? "—"}</strong>
                </p>
              </div>
            </div>

            {/* Cenários */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.scenarios.map((s) => (
                <ScenarioCard key={s.id} s={s} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScenarioCard({ s }: { s: ScenarioResult }) {
  return (
    <Card
      className={`border ${
        s.approved
          ? "border-success/30 bg-success/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {s.emoji} {s.label}
          </p>
          <Badge variant={s.approved ? "default" : "destructive"}>
            {s.approved ? "OK" : "FAIL"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge variant="outline">
            seed: {s.seedAction === "error" ? "erro" : s.seedAction}
          </Badge>
          {s.embedder && (
            <Badge variant="secondary">
              emb: {s.embedder.succeeded}/{s.embedder.failed}/{s.embedder.skipped}
            </Badge>
          )}
          <Badge variant="outline">
            {(s.passRate * 100).toFixed(0)}% pass
          </Badge>
        </div>
        <div className="space-y-1 mt-2">
          {s.variants.map((v) => (
            <div
              key={v.question}
              className="flex items-center justify-between gap-2 text-[11px] border-b border-border/40 pb-1 last:border-0"
            >
              <span className="flex items-center gap-1 truncate">
                {v.matched ? (
                  <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                )}
                <span className="truncate" title={v.question}>
                  {v.question}
                </span>
              </span>
              <span className="font-mono text-muted-foreground shrink-0">
                {v.similarity != null
                  ? `${(v.similarity * 100).toFixed(0)}%`
                  : "—"}
                {v.hybridScore != null
                  ? ` · h${(v.hybridScore * 100).toFixed(0)}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
