/**
 * calculate-approval-score — TRI/IRT Enhanced v2026
 * Recalcula o approval score de um usuário e atualiza chance_by_exam.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireAuth } from "../_shared/require-auth.ts";
import { estimateTheta, thetaToScore } from "../_shared/tri-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MINIMUM_BANCAS = ["enare", "usp", "sus-sp", "unifesp", "unicamp"];
const BANCA_WEIGHTS: Record<string, { acc: number; tri: number; domain: number; sim: number; review: number; consistency: number; osce: number; errorPen: number }> = {
  enare:    { acc: 0.15, tri: 0.15, domain: 0.20, sim: 0.15, review: 0.10, consistency: 0.10, osce: 0.05, errorPen: 0.10 },
  usp:      { acc: 0.10, tri: 0.15, domain: 0.15, sim: 0.20, review: 0.10, consistency: 0.10, osce: 0.10, errorPen: 0.10 },
  unicamp:  { acc: 0.10, tri: 0.15, domain: 0.15, sim: 0.15, review: 0.10, consistency: 0.10, osce: 0.15, errorPen: 0.10 },
  unifesp:  { acc: 0.10, tri: 0.15, domain: 0.20, sim: 0.20, review: 0.10, consistency: 0.10, osce: 0.05, errorPen: 0.10 },
  "sus-sp": { acc: 0.15, tri: 0.15, domain: 0.25, sim: 0.10, review: 0.15, consistency: 0.10, osce: 0.00, errorPen: 0.10 },
};
const DEFAULT_W = { acc: 0.15, tri: 0.10, domain: 0.20, sim: 0.15, review: 0.15, consistency: 0.10, osce: 0.05, errorPen: 0.10 };

async function computeAndPersist(adminClient: ReturnType<typeof createClient>, userId: string, source: string) {
  const [
    practiceRes, domainRes, reviewRes, examRes,
    errorRes, streakRes, clinicalRes, diagnosticRes,
  ] = await Promise.all([
    adminClient.from("practice_attempts").select("correct").eq("user_id", userId).limit(1000),
    adminClient.from("medical_domain_map").select("domain_score, questions_answered").eq("user_id", userId),
    adminClient.from("revisoes").select("status, data_revisao").eq("user_id", userId).limit(500),
    adminClient.from("exam_sessions").select("score, total_questions, status").eq("user_id", userId).eq("status", "finished").order("finished_at", { ascending: false }).limit(20),
    adminClient.from("error_bank").select("dominado, vezes_errado").eq("user_id", userId).limit(500),
    adminClient.from("user_gamification").select("current_streak, longest_streak").eq("user_id", userId).maybeSingle(),
    adminClient.from("simulation_history").select("final_score").eq("user_id", userId).limit(20),
    adminClient.from("diagnostic_sessions").select("score").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
  ]);

  const attempts = practiceRes.data || [];
  const totalAttempts = attempts.length;
  const totalCorrect = attempts.filter((a: any) => a.correct).length;
  const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

  const domains = domainRes.data || [];
  const domainScore = domains.length > 0
    ? domains.reduce((s: number, d: any) => s + (d.domain_score || 0), 0) / domains.length
    : 0;

  const reviews = reviewRes.data || [];
  const totalReviews = reviews.length;
  const completedReviews = reviews.filter((r: any) => r.status === "concluida").length;
  const reviewScore = totalReviews > 0 ? (completedReviews / totalReviews) * 100 : 0;

  const streak = streakRes.data as any;
  const currentStreak = streak?.current_streak || 0;
  const consistencyScore = Math.min(currentStreak * 10, 100);

  const exams = examRes.data || [];
  const clinicals = clinicalRes.data || [];
  const examScores = exams.map((e: any) => Number(e.score)).filter((s: number) => Number.isFinite(s)).map((s: number) => Math.max(0, Math.min(100, s)));
  const clinicalScores = clinicals.map((c: any) => Number(c.final_score)).filter((s: number) => Number.isFinite(s)).map((s: number) => Math.max(0, Math.min(100, s)));
  const allSimScores = [...examScores, ...clinicalScores];
  const simulationScore = allSimScores.length > 0 ? allSimScores.reduce((a: number, b: number) => a + b, 0) / allSimScores.length : 0;

  const errors = errorRes.data || [];
  const activeErrors = errors.filter((e: any) => !e.dominado);
  const totalErrorWeight = activeErrors.reduce((s: number, e: any) => s + (e.vezes_errado || 1), 0);
  const rawPenalty = Math.min(totalErrorWeight / 20, 1) * 100;
  const errorComponent = 100 - rawPenalty;

  const diagnosticSessions = diagnosticRes.data || [];
  const hasDiagnostic = diagnosticSessions.length > 0;
  const diagnosticScore = hasDiagnostic ? (diagnosticSessions[0] as any).score : 0;
  const hasEnoughHistory = totalAttempts >= 50 && totalReviews >= 10;
  const diagnosticWeight = hasDiagnostic ? (hasEnoughHistory ? 0.10 : 0.40) : 0;
  const remainingWeight = 1 - diagnosticWeight;

  const rawScore =
    accuracy * 0.25 * remainingWeight +
    domainScore * 0.15 * remainingWeight +
    reviewScore * 0.15 * remainingWeight +
    consistencyScore * 0.15 * remainingWeight +
    simulationScore * 0.20 * remainingWeight +
    errorComponent * 0.10 * remainingWeight +
    diagnosticScore * diagnosticWeight;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  await adminClient.from("approval_scores").insert({
    user_id: userId,
    score,
    accuracy: Math.round(accuracy * 100) / 100,
    domain_score: Math.round(domainScore * 100) / 100,
    review_score: Math.round(reviewScore * 100) / 100,
    consistency_score: Math.round(consistencyScore * 100) / 100,
    simulation_score: Math.round(simulationScore * 100) / 100,
    error_penalty: Math.round(rawPenalty * 100) / 100,
    details_json: {
      total_attempts: totalAttempts,
      domains_count: domains.length,
      reviews_total: totalReviews,
      reviews_completed: completedReviews,
      current_streak: currentStreak,
      exams_count: exams.length,
      clinical_count: clinicals.length,
      active_errors: activeErrors.length,
      source,
    },
  });

  // Chance by Exam
  const { data: profileData } = await adminClient.from("profiles").select("target_exams").eq("user_id", userId).maybeSingle();
  const targetExams: string[] = (profileData as any)?.target_exams || [];
  const bancasToCalc = [...new Set([...targetExams, ...MINIMUM_BANCAS])];

  const osceScore = clinicalScores.length > 0
    ? clinicalScores.reduce((a: number, b: number) => a + b, 0) / clinicalScores.length
    : 0;

  const chanceResults: { banca: string; chance_score: number; factors: any }[] = [];
  for (const banca of bancasToCalc) {
    const w = BANCA_WEIGHTS[banca] || DEFAULT_W;
    const raw =
      accuracy * w.acc + domainScore * w.domain + simulationScore * w.sim +
      reviewScore * w.review + consistencyScore * w.consistency +
      osceScore * w.osce + errorComponent * w.errorPen;
    const chanceScore = Math.max(0, Math.min(100, Math.round(raw)));
    const factors = {
      accuracy: Math.round(accuracy * 100) / 100,
      domainScore: Math.round(domainScore * 100) / 100,
      simulationScore: Math.round(simulationScore * 100) / 100,
      reviewScore: Math.round(reviewScore * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      osceScore: Math.round(osceScore * 100) / 100,
      errorComponent: Math.round(errorComponent * 100) / 100,
      weights: w,
      dataPoints: { totalAttempts, domainsCount: domains.length, examsCount: exams.length, clinicalCount: clinicals.length, reviewsTotal: totalReviews, currentStreak },
    };
    chanceResults.push({ banca, chance_score: chanceScore, factors });
    await adminClient.from("chance_by_exam").upsert(
      { user_id: userId, banca, chance_score: chanceScore, factors_json: factors, updated_at: new Date().toISOString() },
      { onConflict: "user_id,banca" }
    );
  }

  const phase = score < 50 ? "critico" : score < 70 ? "atencao" : score < 85 ? "competitivo" : "pronto";
  return {
    score,
    accuracy: Math.round(accuracy * 100) / 100,
    domain_score: Math.round(domainScore * 100) / 100,
    review_score: Math.round(reviewScore * 100) / 100,
    consistency_score: Math.round(consistencyScore * 100) / 100,
    simulation_score: Math.round(simulationScore * 100) / 100,
    error_penalty: Math.round(rawPenalty * 100) / 100,
    phase,
    chance_by_exam: chanceResults,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK */ }

    const apikey = req.headers.get("apikey") ?? "";
    const authz = req.headers.get("Authorization") ?? "";
    const isServiceRoleCall = apikey === serviceRoleKey || authz === `Bearer ${serviceRoleKey}`;

    let targetUserId: string;
    let source = String(body?.source ?? "manual");

    if (isServiceRoleCall) {
      targetUserId = String(body?.target_user_id ?? body?.user_id ?? "");
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "target_user_id required for service-role call" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      source = source || "service-role";
    } else {
      const auth = await requireAuth(req);
      if (!auth.ok) return auth.response;
      targetUserId = auth.userId;
    }

    const result = await computeAndPersist(adminClient, targetUserId, source);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("calculate-approval-score error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
