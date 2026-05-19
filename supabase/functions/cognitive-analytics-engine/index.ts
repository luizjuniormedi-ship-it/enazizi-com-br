/**
 * Cognitive Analytics Engine v3 — Trajectory Intelligence
 *
 * Infere continuamente o estado cognitivo do aluno a partir de:
 *  - FSRS cards (stability/difficulty/due)
 *  - error_bank (erros não dominados)
 *  - performance_unified (taxa de acerto, volume, dias ativos)
 *  - simulado_sessions (exposição a prova)
 *  - tutor_events / sessões recentes (fadiga e ritmo)
 *
 * Persiste em cognitive_analytics um snapshot completo com:
 *   overall_retention, fatigue_score, cognitive_pressure, memory_decay_rate,
 *   confidence_score, collapse_risk, abandonment_risk, learning_velocity,
 *   mastery_index, consistency_index, projected_retention_14d
 *
 * NUNCA derruba erro fatal — sempre devolve 200 com success flag.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const now = new Date();
    const d14Iso = new Date(now.getTime() - 14 * 86400_000).toISOString();
    const d28Iso = new Date(now.getTime() - 28 * 86400_000).toISOString();
    const d7Iso = new Date(now.getTime() - 7 * 86400_000).toISOString();

    // ─── Coleta paralela ─────────────────────────────────────────────────────
    const [fsrsRes, errorsRes, perfRes, simRes, eventsRes] = await Promise.all([
      supabase.from("fsrs_cards").select("stability,difficulty,due_at").eq("user_id", userId).limit(5000),
      supabase.from("error_bank").select("id,created_at").eq("user_id", userId).eq("dominado", false).limit(2000),
      supabase.from("performance_unified")
        .select("data_registro,questoes_feitas,questoes_erradas,taxa_acerto")
        .eq("user_id", userId).gte("data_registro", d28Iso),
      supabase.from("simulado_sessions").select("id,finished_at,score").eq("user_id", userId).gte("finished_at", d28Iso),
      supabase.from("tutor_events").select("event_type,created_at").eq("user_id", userId).gte("created_at", d14Iso).limit(500),
    ]);

    const cards = fsrsRes.data ?? [];
    const errors = errorsRes.data ?? [];
    const perf = perfRes.data ?? [];
    const sims = simRes.data ?? [];
    const events = eventsRes.data ?? [];

    // ─── Métricas FSRS ───────────────────────────────────────────────────────
    const overdue = cards.filter((c: any) => c.due_at && new Date(c.due_at) < now);
    const overdueRatio = cards.length > 0 ? overdue.length / cards.length : 0;

    const avgStability = cards.length > 0
      ? cards.reduce((s: number, c: any) => s + (Number(c.stability) || 0), 0) / cards.length
      : 0;
    const avgDifficulty = cards.length > 0
      ? cards.reduce((s: number, c: any) => s + (Number(c.difficulty) || 5), 0) / cards.length
      : 5;

    // Retenção projetada via stability decay aproximada
    const retentionNow = cards.length > 0
      ? cards.reduce((s: number, c: any) => {
          const stab = Math.max(0.1, Number(c.stability) || 1);
          const due = c.due_at ? new Date(c.due_at).getTime() : now.getTime();
          const elapsed = Math.max(0, (now.getTime() - due) / 86400_000);
          return s + Math.exp(-elapsed / Math.max(1, stab));
        }, 0) / cards.length
      : 0.7;

    const retention14d = cards.length > 0
      ? cards.reduce((s: number, c: any) => {
          const stab = Math.max(0.1, Number(c.stability) || 1);
          return s + Math.exp(-14 / Math.max(1, stab));
        }, 0) / cards.length
      : 0.6;

    const memoryDecayRate = clamp01(1 - retention14d);

    // ─── Performance / consistência ──────────────────────────────────────────
    let q28 = 0, accSum = 0, accN = 0;
    const activeDays = new Set<string>();
    perf.forEach((r: any) => {
      q28 += r.questoes_feitas ?? 0;
      const d = (r.data_registro ?? "").toString().slice(0, 10);
      if (d) activeDays.add(d);
      if (typeof r.taxa_acerto === "number") { accSum += r.taxa_acerto; accN++; }
    });
    const accuracy = accN > 0 ? accSum / accN : 0;
    const consistencyIndex = clamp01(activeDays.size / 20); // 20 dias ativos em 28 = ideal

    // Sessões recentes
    const sessions7d = events.filter((e: any) =>
      e.event_type === "session_start" && new Date(e.created_at) >= new Date(d7Iso)
    ).length;

    // ─── Fadiga e pressão cognitiva ──────────────────────────────────────────
    // Fadiga: muitos erros recentes + muitas sessões + difficulty alta
    const recentErrors = errors.filter((e: any) =>
      e.created_at && new Date(e.created_at) >= new Date(d7Iso)
    ).length;
    const fatigueScore = clamp100(
      recentErrors * 4 +
      Math.max(0, sessions7d - 5) * 6 +
      (avgDifficulty - 5) * 8
    );

    // Pressão cognitiva: backlog FSRS + erros abertos
    const cognitivePressure = clamp100(
      overdueRatio * 70 + Math.min(30, errors.length * 0.5)
    );

    // ─── Confiança ───────────────────────────────────────────────────────────
    // Cresce com acurácia consistente, cai com erros recentes
    const confidenceScore = clamp01(
      (accuracy / 100) * 0.7 +
      (1 - Math.min(1, recentErrors / 20)) * 0.3
    );

    // ─── Velocidade de aprendizado ───────────────────────────────────────────
    // Aproximação: stability média / dificuldade média
    const learningVelocity = clamp01(avgStability / Math.max(1, avgDifficulty * 4));

    // ─── Mastery index ───────────────────────────────────────────────────────
    const masteryIndex = clamp01(
      (accuracy / 100) * 0.5 +
      retention14d * 0.3 +
      Math.min(1, q28 / 600) * 0.2
    );

    // ─── Riscos longitudinais ────────────────────────────────────────────────
    // Abandono: queda de consistência + ausência de sessões
    const abandonmentRisk = clamp01(
      (1 - consistencyIndex) * 0.6 +
      (sessions7d === 0 ? 0.4 : Math.max(0, 0.4 - sessions7d * 0.08))
    );

    // Colapso cognitivo: fadiga alta + pressão alta + retenção caindo
    const collapseRisk = clamp01(
      (fatigueScore / 100) * 0.4 +
      (cognitivePressure / 100) * 0.4 +
      (1 - retentionNow) * 0.2
    );

    const overloadFlag = fatigueScore > 80 || cognitivePressure > 85 || collapseRisk > 0.75;

    // ─── Recovery success: cards revisados com sucesso recentemente ──────────
    const recoverySuccessRate = clamp01(
      cards.length > 0 ? (1 - overdueRatio) * (accuracy / 100 || 0.5) : 0
    );

    // ─── Persiste snapshot ───────────────────────────────────────────────────
    const payload = {
      user_id: userId,
      overall_retention: Number(retentionNow.toFixed(4)),
      fatigue_score: Number(fatigueScore.toFixed(2)),
      cognitive_pressure: Number(cognitivePressure.toFixed(2)),
      memory_decay_rate: Number(memoryDecayRate.toFixed(4)),
      overload_flag: overloadFlag,
      recovery_success_rate: Number(recoverySuccessRate.toFixed(4)),
      confidence_score: Number(confidenceScore.toFixed(4)),
      collapse_risk: Number(collapseRisk.toFixed(4)),
      abandonment_risk: Number(abandonmentRisk.toFixed(4)),
      learning_velocity: Number(learningVelocity.toFixed(4)),
      mastery_index: Number(masteryIndex.toFixed(4)),
      consistency_index: Number(consistencyIndex.toFixed(4)),
      projected_retention_14d: Number(retention14d.toFixed(4)),
      computed_at: now.toISOString(),
    };

    const { error: insErr } = await supabase.from("cognitive_analytics").insert(payload);
    if (insErr) console.error("[CognitiveEngine v3] insert error:", insErr);

    return new Response(JSON.stringify({
      success: true,
      metrics: payload,
      signals: {
        cardsTotal: cards.length,
        overdue: overdue.length,
        activeErrors: errors.length,
        recentErrors,
        sessions7d,
        questoes28d: q28,
        simulados28d: sims.length,
        accuracy,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[CognitiveEngine v3] Fatal:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
