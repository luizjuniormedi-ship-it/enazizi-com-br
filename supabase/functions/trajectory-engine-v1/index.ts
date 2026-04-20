/**
 * trajectory-engine-v1 — Motor 100% determinístico do Radar de Trajetória IA.
 *
 * Lê dados reais do aluno (FSRS, error_bank, simulados, desempenho_questoes,
 * approval_scores, profiles) e produz:
 *   - 1 snapshot consolidado
 *   - 4 cenários (current/conservative/aggressive/recommended) em 14/28/56 dias
 *   - lista de riscos, oportunidades e recomendações ligadas ao orquestrador
 *
 * Persistência: trajectory_runs / trajectory_snapshots / trajectory_scenarios /
 * trajectory_risk_factors / trajectory_opportunities / trajectory_recommendations.
 *
 * NUNCA propaga erro fatal para o cliente: sempre devolve 200 com success=false
 * + mensagem amigável. Falha silenciosa em queries individuais (safeQuery).
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery,
} from "../_shared/assistant-helpers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 2) => Number(n.toFixed(d));

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

// ─────────────────────────────────────────────────────────────────────────────
// Coleta de sinais
// ─────────────────────────────────────────────────────────────────────────────
async function collectSignals(db: ReturnType<typeof getServiceClient>, userId: string) {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString();
  const d28 = new Date(now.getTime() - 28 * 24 * 3600 * 1000).toISOString();
  const nowIso = now.toISOString();

  // Volume de questões (desempenho_questoes é a fonte primária do ENAZIZI)
  const desempenho28 = await safeQuery<any[]>(
    db,
    (c) => c.from("desempenho_questoes")
      .select("data_registro, questoes_feitas, questoes_erradas, taxa_acerto")
      .eq("user_id", userId)
      .gte("data_registro", d28),
    "desempenho_28d"
  );

  let q7 = 0, q28 = 0, accSum = 0, accN = 0;
  const activeDays = new Set<string>();
  (desempenho28 ?? []).forEach((r: any) => {
    const dt = new Date(r.data_registro);
    q28 += r.questoes_feitas ?? 0;
    if (dt.getTime() >= now.getTime() - 7 * 24 * 3600 * 1000) q7 += r.questoes_feitas ?? 0;
    if (dt.getTime() >= now.getTime() - 14 * 24 * 3600 * 1000) {
      activeDays.add(r.data_registro?.split("T")[0]);
    }
    if (typeof r.taxa_acerto === "number") {
      accSum += r.taxa_acerto;
      accN += 1;
    }
  });
  const accuracy = accN > 0 ? accSum / accN : null;

  // FSRS — vencidas e pendentes (fsrs_cards)
  const fsrsDue = await safeQuery<any[]>(
    db,
    (c) => c.from("fsrs_cards")
      .select("id, due_at")
      .eq("user_id", userId)
      .lte("due_at", nowIso)
      .limit(2000),
    "fsrs_due"
  );
  const fsrsDueCount = fsrsDue?.length ?? 0;
  const fsrsOverdueCount = (fsrsDue ?? []).filter((r: any) => {
    if (!r.due_at) return false;
    return daysBetween(now, new Date(r.due_at)) >= 2;
  }).length;

  // Error Bank — erros não dominados
  const errorOpen = await safeQuery<any[]>(
    db,
    (c) => c.from("error_bank")
      .select("id")
      .eq("user_id", userId)
      .eq("dominado", false)
      .limit(2000),
    "error_open"
  );

  // Simulados últimos 28d
  const simulados = await safeQuery<any[]>(
    db,
    (c) => c.from("simulado_sessions")
      .select("id, finished_at")
      .eq("user_id", userId)
      .gte("finished_at", d28)
      .limit(500),
    "simulados_28d"
  );

  // Approval score
  const approval = await safeQuery<any[]>(
    db,
    (c) => c.from("approval_scores")
      .select("score, prep_index, chance_score, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
    "approval_score"
  );

  // Profile (proximidade de prova)
  const profile = await safeQuery<any[]>(
    db,
    (c) => c.from("profiles")
      .select("exam_date")
      .eq("user_id", userId)
      .limit(1),
    "profile_exam"
  );
  let examProximityDays: number | null = null;
  const examDate = (profile?.[0] as any)?.exam_date;
  if (examDate) {
    const dt = new Date(examDate);
    if (!Number.isNaN(dt.getTime())) {
      examProximityDays = Math.max(0, daysBetween(dt, now));
    }
  }

  return {
    q7,
    q28,
    activeDays14: activeDays.size,
    accuracy,
    fsrsDueCount,
    fsrsOverdueCount,
    errorBankOpenCount: errorOpen?.length ?? 0,
    simuladoCount28d: simulados?.length ?? 0,
    approvalScore: (approval?.[0] as any)?.score ?? null,
    examProximityDays,
    sampleSize: (desempenho28?.length ?? 0) + (simulados?.length ?? 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo de scores (0–100)
// ─────────────────────────────────────────────────────────────────────────────
function computeScores(s: Awaited<ReturnType<typeof collectSignals>>) {
  // Consistência: dias ativos em 14d (alvo 10/14)
  const consistencyScore = clamp((s.activeDays14 / 10) * 100);

  // Retenção: aproximação por acurácia + carga FSRS vencida
  let retentionScore = s.accuracy != null ? clamp(s.accuracy) : 50;
  if (s.fsrsOverdueCount > 30) retentionScore = clamp(retentionScore - 20);
  else if (s.fsrsOverdueCount > 10) retentionScore = clamp(retentionScore - 10);

  // Execução: volume médio diário (alvo 30 q/dia ≈ 840 em 28d)
  const executionScore = clamp((s.q28 / 840) * 100);

  // Backlog: quanto MENOR o backlog, maior o score
  const backlogPenalty =
    Math.min(100, s.fsrsOverdueCount * 1.5) * 0.5 +
    Math.min(100, s.errorBankOpenCount * 0.8) * 0.5;
  const backlogScore = clamp(100 - backlogPenalty);

  // Overall ponderado
  const overallScore = clamp(
    consistencyScore * 0.25 +
      retentionScore * 0.30 +
      executionScore * 0.20 +
      backlogScore * 0.25
  );

  // Confiança em função do tamanho da amostra
  let confidenceScore = 30;
  if (s.sampleSize >= 5) confidenceScore = 50;
  if (s.sampleSize >= 15) confidenceScore = 70;
  if (s.sampleSize >= 40) confidenceScore = 85;
  if (s.sampleSize >= 80) confidenceScore = 95;

  return {
    consistencyScore: round(consistencyScore),
    retentionScore: round(retentionScore),
    executionScore: round(executionScore),
    backlogScore: round(backlogScore),
    overallScore: round(overallScore),
    confidenceScore: round(confidenceScore),
    retentionProxy: s.accuracy != null ? round(s.accuracy) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cenários (projeção determinística simples)
// ─────────────────────────────────────────────────────────────────────────────
type ScenarioType = "current" | "conservative" | "aggressive" | "recommended";

function projectScenario(
  base: ReturnType<typeof computeScores>,
  type: ScenarioType,
  horizon: 14 | 28 | 56
) {
  // Fatores horizonte (quanto mais tempo, mais o esforço se acumula)
  const h = horizon / 28;

  // Multiplicadores por cenário (delta esperado em cada eixo)
  const profile: Record<ScenarioType, {
    cons: number; ret: number; exec: number; back: number;
    cost: number; risk: number;
  }> = {
    current:      { cons: 0,    ret: 0,    exec: 0,    back: -2,  cost: 0.0, risk: 0.10 },
    conservative: { cons: +5,   ret: +12,  exec: -3,   back: +18, cost: 0.4, risk: 0.05 },
    aggressive:   { cons: +10,  ret: -3,   exec: +20,  back: +5,  cost: 0.9, risk: 0.45 },
    recommended:  { cons: +8,   ret: +10,  exec: +8,   back: +12, cost: 0.6, risk: 0.18 },
  };

  const p = profile[type];
  const pc = clamp(base.consistencyScore + p.cons * h);
  const pr = clamp(base.retentionScore + p.ret * h);
  const pe = clamp(base.executionScore + p.exec * h);
  const pb = clamp(base.backlogScore + p.back * h);
  const po = clamp(pc * 0.25 + pr * 0.30 + pe * 0.20 + pb * 0.25);

  return {
    scenarioType: type,
    horizonDays: horizon,
    projectedConsistency: round(pc),
    projectedRetention: round(pr),
    projectedExecution: round(pe),
    projectedBacklog: round(pb),
    projectedOverall: round(po),
    deltaOverall: round(po - base.overallScore),
    costIntensity: p.cost,
    retentionRisk: p.risk,
    confidenceScore: base.confidenceScore,
    assumptions: { horizon, multipliers: p },
    rationale:
      type === "current" ? "Mantém o ritmo atual sem mudanças."
      : type === "conservative" ? "Aumenta revisão e reduz conteúdo novo para consolidar."
      : type === "aggressive" ? "Acelera execução e volume, com maior risco de queda na retenção."
      : "Mistura revisão consistente, simulado periódico e redução de backlog.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Riscos / Oportunidades / Recomendações (regras explicáveis)
// ─────────────────────────────────────────────────────────────────────────────
function deriveInsights(
  s: Awaited<ReturnType<typeof collectSignals>>,
  sc: ReturnType<typeof computeScores>
) {
  const risks: any[] = [];
  const opps: any[] = [];
  const recs: any[] = [];

  // Risco: backlog FSRS alto
  if (s.fsrsOverdueCount >= 20) {
    risks.push({
      risk_key: "fsrs_backlog_high",
      title: "Acúmulo alto de revisões vencidas",
      description: `${s.fsrsOverdueCount} cartões com revisão atrasada. Tende a derrubar a retenção.`,
      severity: s.fsrsOverdueCount >= 60 ? "critical" : "high",
      impact_score: Math.min(100, s.fsrsOverdueCount * 1.2),
      evidence: { fsrsOverdueCount: s.fsrsOverdueCount },
    });
    recs.push({
      recommendation_key: "boost_review_fsrs",
      title: "Sessão dedicada a revisões atrasadas",
      description: "Limpar revisões vencidas em blocos de 20–30 cartões por dia.",
      orchestrator_action: "review_fsrs",
      target_module: "/revisao",
      payload: { focus: "overdue" },
      expected_impact: 18,
      effort_level: "medium",
      priority: 90,
      rationale: "Reduz dívida cognitiva e estabiliza retenção em 1–2 semanas.",
      badges: ["high_review_urgency"],
    });
  }

  // Risco: inconsistência
  if (s.activeDays14 < 6) {
    risks.push({
      risk_key: "inconsistency",
      title: "Frequência de estudo baixa",
      description: `Apenas ${s.activeDays14} dias ativos nas últimas 2 semanas.`,
      severity: s.activeDays14 < 3 ? "high" : "medium",
      impact_score: 60 - s.activeDays14 * 6,
      evidence: { activeDays14: s.activeDays14 },
    });
    recs.push({
      recommendation_key: "daily_micro_session",
      title: "Micro-sessão diária guiada",
      description: "Plano leve do dia para criar hábito (15–20 min).",
      orchestrator_action: "study_session",
      target_module: "/sessao-estudo",
      payload: { intensity: "light" },
      expected_impact: 12,
      effort_level: "low",
      priority: 75,
      rationale: "Consistência diária pesa 25% no score geral.",
      badges: ["fatigue_aware"],
    });
  }

  // Risco: pouco simulado
  if (s.simuladoCount28d < 2) {
    risks.push({
      risk_key: "low_simulado",
      title: "Pouca exposição a simulados",
      description: `${s.simuladoCount28d} simulado(s) em 28 dias.`,
      severity: "medium",
      impact_score: 45,
      evidence: { simuladoCount28d: s.simuladoCount28d },
    });
    recs.push({
      recommendation_key: "schedule_simulado",
      title: "Agendar 1 simulado curto esta semana",
      description: "Simulado de 30–40 questões para calibrar nível e identificar lacunas.",
      orchestrator_action: "simulado",
      target_module: "/simulados",
      payload: { length: "short" },
      expected_impact: 14,
      effort_level: "medium",
      priority: 70,
      rationale: "Simulado regular é o melhor preditor de desempenho real.",
      badges: ["phase_aligned"],
    });
  }

  // Oportunidade: erro_bank com alto volume → reforço dirigido
  if (s.errorBankOpenCount >= 10) {
    opps.push({
      opportunity_key: "error_bank_reinforce",
      title: "Banco de erros pronto para reforço",
      description: `${s.errorBankOpenCount} erros não dominados disponíveis para retomar.`,
      potential_gain: Math.min(25, s.errorBankOpenCount * 0.6),
      effort_level: "medium",
      evidence: { errorBankOpenCount: s.errorBankOpenCount },
    });
    recs.push({
      recommendation_key: "error_review_block",
      title: "Bloco de reforço de erros (20 questões)",
      description: "Refazer questões dos erros mais recentes em modo guiado.",
      orchestrator_action: "error_review",
      target_module: "/banco-erros",
      payload: { batch: 20 },
      expected_impact: 16,
      effort_level: "medium",
      priority: 80,
      rationale: "Converter erros recentes em acerto é o caminho mais rápido para subir acurácia.",
      badges: ["repetition_avoided"],
    });
  }

  // Oportunidade: acurácia decente mas execução baixa
  if ((s.accuracy ?? 0) >= 60 && sc.executionScore < 50) {
    opps.push({
      opportunity_key: "scale_volume",
      title: "Margem para aumentar volume",
      description: "Acurácia razoável e volume abaixo do recomendado.",
      potential_gain: 15,
      effort_level: "medium",
      evidence: { accuracy: s.accuracy, executionScore: sc.executionScore },
    });
  }

  // Sempre incluir uma rec genérica de tutor para contexto
  recs.push({
    recommendation_key: "tutor_review_weakest",
    title: "Conversa com o Tutor sobre seu ponto mais fraco",
    description: "Esclarecer dúvida ativa antes de reforçar com questões.",
    orchestrator_action: "tutor",
    target_module: "/tutor",
    payload: {},
    expected_impact: 8,
    effort_level: "low",
    priority: 50,
    rationale: "Compreensão sólida acelera o ganho posterior em questões.",
    badges: ["tutor_favored"],
  });

  return { risks, opps, recs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  const db = getServiceClient();
  let userId: string;
  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    return errorResponse("Autenticação necessária", 401);
  }

  let triggerSource = "manual";
  try {
    const body = await req.json().catch(() => ({}));
    triggerSource = body?.triggerSource ?? "manual";
  } catch { /* noop */ }

  // 1) abrir run
  const { data: runRow } = await db
    .from("trajectory_runs")
    .insert({ user_id: userId, status: "running", trigger_source: triggerSource })
    .select("id")
    .single();
  const runId = runRow?.id as string | undefined;

  try {
    const signals = await collectSignals(db, userId);
    const scores = computeScores(signals);

    const completeness =
      signals.sampleSize >= 40 ? "complete" :
      signals.sampleSize >= 10 ? "partial" : "insufficient";

    // 2) snapshot
    const { data: snap, error: snapErr } = await db
      .from("trajectory_snapshots")
      .insert({
        user_id: userId,
        run_id: runId ?? null,
        questions_last_7d: signals.q7,
        questions_last_28d: signals.q28,
        active_days_last_14d: signals.activeDays14,
        fsrs_due_count: signals.fsrsDueCount,
        fsrs_overdue_count: signals.fsrsOverdueCount,
        error_bank_open_count: signals.errorBankOpenCount,
        simulado_count_last_28d: signals.simuladoCount28d,
        accuracy_last_28d: signals.accuracy,
        retention_proxy: scores.retentionProxy,
        exam_proximity_days: signals.examProximityDays,
        consistency_score: scores.consistencyScore,
        retention_score: scores.retentionScore,
        execution_score: scores.executionScore,
        backlog_score: scores.backlogScore,
        overall_score: scores.overallScore,
        confidence_score: scores.confidenceScore,
        data_completeness: completeness,
        raw_signals: signals as unknown as Record<string, unknown>,
      })
      .select("*")
      .single();
    if (snapErr || !snap) throw new Error(snapErr?.message ?? "snapshot insert failed");

    // 3) cenários × 4 × 3 horizontes
    const horizons: (14 | 28 | 56)[] = [14, 28, 56];
    const types: ScenarioType[] = ["current", "conservative", "aggressive", "recommended"];
    const scenarioRows = horizons.flatMap((h) =>
      types.map((t) => {
        const proj = projectScenario(scores, t, h);
        return {
          user_id: userId,
          snapshot_id: snap.id,
          scenario_type: proj.scenarioType,
          horizon_days: proj.horizonDays,
          projected_consistency: proj.projectedConsistency,
          projected_retention: proj.projectedRetention,
          projected_execution: proj.projectedExecution,
          projected_backlog: proj.projectedBacklog,
          projected_overall: proj.projectedOverall,
          delta_overall: proj.deltaOverall,
          cost_intensity: proj.costIntensity,
          retention_risk: proj.retentionRisk,
          confidence_score: proj.confidenceScore,
          assumptions: proj.assumptions,
          rationale: proj.rationale,
        };
      })
    );
    const { data: scenarios, error: scErr } = await db
      .from("trajectory_scenarios").insert(scenarioRows).select("*");
    if (scErr) throw new Error(scErr.message);

    // 4) insights
    const { risks, opps, recs } = deriveInsights(signals, scores);
    const stamp = (rows: any[]) =>
      rows.map((r) => ({ ...r, user_id: userId, snapshot_id: snap.id }));

    const [risksRes, oppsRes, recsRes] = await Promise.all([
      risks.length
        ? db.from("trajectory_risk_factors").insert(stamp(risks)).select("*")
        : Promise.resolve({ data: [], error: null }),
      opps.length
        ? db.from("trajectory_opportunities").insert(stamp(opps)).select("*")
        : Promise.resolve({ data: [], error: null }),
      recs.length
        ? db.from("trajectory_recommendations").insert(stamp(recs)).select("*")
        : Promise.resolve({ data: [], error: null }),
    ]);

    // 5) fechar run
    await db.from("trajectory_runs").update({
      status: "success",
      duration_ms: Date.now() - t0,
      snapshot_id: snap.id,
    }).eq("id", runId);

    return jsonResponse({
      success: true,
      runId,
      snapshot: snap,
      scenarios: scenarios ?? [],
      risks: risksRes.data ?? [],
      opportunities: oppsRes.data ?? [],
      recommendations: recsRes.data ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[trajectory-engine-v1]", msg);
    if (runId) {
      await db.from("trajectory_runs").update({
        status: "failed",
        duration_ms: Date.now() - t0,
        error_message: msg,
      }).eq("id", runId);
    }
    return jsonResponse({ success: false, error: msg, runId: runId ?? null }, 200);
  }
});
