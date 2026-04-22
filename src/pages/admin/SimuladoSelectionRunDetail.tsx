import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Database,
  Sparkles,
  Image as ImageIcon,
  AlertTriangle,
  Layers,
  ShieldAlert,
} from "lucide-react";

interface RunDetail {
  id: string;
  created_at: string;
  user_id: string | null;
  endpoint: string;
  mode: string | null;
  banca: string | null;
  user_profile: string | null;
  requested_count: number | null;
  final_count: number | null;
  source_pool_textual: number;
  source_pool_structural: number;
  source_image_pipeline: number;
  source_ai_generated: number;
  source_fallback: number;
  granular_eligible: boolean;
  granular_fallback_reason: string | null;
  classification_pct_specialty: number | null;
  classification_pct_topic: number | null;
  classification_pct_subtopic: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
}

const REASON_DESCRIPTIONS: Record<string, { label: string; explanation: string; tone: string }> = {
  flag_off: {
    label: "Flag desativada",
    explanation: "A feature flag granular está desligada — pipeline legado por padrão.",
    tone: "bg-muted text-muted-foreground",
  },
  no_banca_provided: {
    label: "Sem banca",
    explanation: "Nenhuma banca foi informada na requisição, então a distribuição dinâmica não foi acionada.",
    tone: "bg-muted text-muted-foreground",
  },
  banca_nao_pronta: {
    label: "Banca não pronta",
    explanation: "A banca alvo ainda não atingiu cobertura curricular suficiente (ver Banca Readiness).",
    tone: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  questions_not_classified: {
    label: "Questões não classificadas",
    explanation: "O banco de questões não atingiu o threshold mínimo de classificação hierárquica (specialty/topic/subtopic).",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  },
  coverage_insufficient: {
    label: "Cobertura insuficiente",
    explanation: "Cobertura curricular vs. questões classificadas abaixo do mínimo para gerar com segurança.",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  },
  empty_distribution: {
    label: "Distribuição vazia",
    explanation: "A distribuição dinâmica retornou vazia — nenhum subtema elegível.",
    tone: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  guard_error: {
    label: "Erro no guard",
    explanation: "O guard de elegibilidade falhou — fallback acionado por segurança.",
    tone: "bg-red-500/20 text-red-700 dark:text-red-400",
  },
  no_attempt: {
    label: "Sem tentativa",
    explanation: "O pipeline granular nem foi tentado nesta execução.",
    tone: "bg-muted text-muted-foreground",
  },
};

export default function SimuladoSelectionRunDetail() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("simulado_selection_runs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      if (data) setRun(data as unknown as RunDetail);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {error ?? "Execução não encontrada."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = Math.max(
    1,
    run.source_pool_textual +
      run.source_pool_structural +
      run.source_image_pipeline +
      run.source_ai_generated +
      run.source_fallback,
  );

  const sources = [
    {
      key: "textual",
      label: "Pool textual (legado)",
      desc: "Questões selecionadas por filtro textual (topic ilike) do pool real.",
      count: run.source_pool_textual,
      icon: <Database className="h-4 w-4" />,
      tone: "from-slate-500/20 to-slate-500/5 border-slate-500/30",
    },
    {
      key: "structural",
      label: "Pool estrutural",
      desc: "Questões selecionadas por IDs hierárquicos (specialty_id / topic_id / subtopic_id).",
      count: run.source_pool_structural,
      icon: <Layers className="h-4 w-4" />,
      tone: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
    },
    {
      key: "image",
      label: "Pipeline de imagem",
      desc: "Questões originadas do banco multimodal (medical_image_questions).",
      count: run.source_image_pipeline,
      icon: <ImageIcon className="h-4 w-4" />,
      tone: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    },
    {
      key: "ai",
      label: "Geradas por IA",
      desc: "Questões complementares geradas em runtime para fechar a contagem.",
      count: run.source_ai_generated,
      icon: <Sparkles className="h-4 w-4" />,
      tone: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    },
    {
      key: "fallback",
      label: "Fallback",
      desc: "Questões adicionadas por mecanismo de fallback de emergência.",
      count: run.source_fallback,
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: "from-red-500/20 to-red-500/5 border-red-500/30",
    },
  ];

  const reason = run.granular_fallback_reason
    ? REASON_DESCRIPTIONS[run.granular_fallback_reason] ?? {
        label: run.granular_fallback_reason,
        explanation: "Razão não catalogada.",
        tone: "bg-muted text-muted-foreground",
      }
    : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <BackLink />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-2xl">Execução {run.id.slice(0, 8)}…</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(run.created_at).toLocaleString("pt-BR")} · endpoint {" "}
                <code className="text-xs">{run.endpoint}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {run.granular_eligible ? (
                <Badge>Granular elegível</Badge>
              ) : (
                <Badge variant="secondary">Granular não elegível</Badge>
              )}
              {run.mode && <Badge variant="outline">modo: {run.mode}</Badge>}
              {run.banca && <Badge variant="outline">banca: {run.banca}</Badge>}
              {run.user_profile && (
                <Badge variant="outline">perfil: {run.user_profile}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Pedidas" value={run.requested_count?.toString() ?? "—"} />
            <Stat label="Final" value={run.final_count?.toString() ?? "0"} />
            <Stat
              label="Duração"
              value={run.duration_ms != null ? `${run.duration_ms} ms` : "—"}
            />
            <Stat
              label="Fallback total"
              value={run.source_fallback.toString()}
              tone={run.source_fallback > 0 ? "warn" : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {/* Source mix item a item */}
      <Card>
        <CardHeader>
          <CardTitle>Source mix item a item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.map((s) => {
            const pct = Math.round((s.count / total) * 100);
            return (
              <div
                key={s.key}
                className={`rounded-lg border bg-gradient-to-r ${s.tone} p-4`}
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {s.icon}
                    {s.label}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold tabular-nums">{s.count}</span>
                    <Badge variant="outline" className="tabular-nums">
                      {pct}%
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                  <div
                    className="h-full bg-foreground/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Razão de fallback */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Razão de fallback / elegibilidade granular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason ? (
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={reason.tone}>{run.granular_fallback_reason}</Badge>
                <span className="font-medium text-sm">{reason.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{reason.explanation}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem razão de fallback registrada — execução considerada limpa pelo guard.
            </p>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">
              Snapshot de classificação no momento da execução
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="% specialty_id"
                value={
                  run.classification_pct_specialty != null
                    ? `${run.classification_pct_specialty}%`
                    : "—"
                }
                tone={toneFor(run.classification_pct_specialty, 70, 30)}
              />
              <Stat
                label="% topic_id"
                value={
                  run.classification_pct_topic != null
                    ? `${run.classification_pct_topic}%`
                    : "—"
                }
                tone={toneFor(run.classification_pct_topic, 50, 20)}
              />
              <Stat
                label="% subtopic_id"
                value={
                  run.classification_pct_subtopic != null
                    ? `${run.classification_pct_subtopic}%`
                    : "—"
                }
                tone={toneFor(run.classification_pct_subtopic, 30, 10)}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Thresholds: specialty ≥ 70% • topic ≥ 50% • subtopic ≥ 30%.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Metadata bruto */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata bruto</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto max-h-96">
            {JSON.stringify(run.metadata ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/admin/simulado-selection">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar para telemetria
      </Link>
    </Button>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "text-green-600 dark:text-green-400"
      : tone === "warn"
      ? "text-yellow-600 dark:text-yellow-400"
      : tone === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function toneFor(
  value: number | null,
  okThreshold: number,
  warnThreshold: number,
): "ok" | "warn" | "bad" | undefined {
  if (value == null) return undefined;
  if (value >= okThreshold) return "ok";
  if (value >= warnThreshold) return "warn";
  return "bad";
}
