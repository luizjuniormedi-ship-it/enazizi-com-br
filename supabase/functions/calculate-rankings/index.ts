import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];

    // ── Gather all users ──
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id")
      .in("status", ["active", "approved"]);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = profiles.map((p: any) => p.user_id);

    // ── Batch fetch data for all users ──
    const [gamRes, approvalRes, plansRes, simHistRes, anamRes, reviewsRes] = await Promise.all([
      admin.from("user_gamification").select("user_id, current_streak, xp, level, weekly_xp").in("user_id", userIds),
      admin.from("approval_scores").select("user_id, score, accuracy, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      admin.from("daily_plans").select("user_id, completed_count, total_blocks, plan_date").eq("plan_date", today).in("user_id", userIds),
      admin.from("simulation_history").select("user_id, final_score").in("user_id", userIds).limit(1000),
      admin.from("anamnesis_results").select("user_id, final_score").in("user_id", userIds).limit(1000),
      admin.from("revisoes").select("user_id, status, data_revisao").in("user_id", userIds).gte("data_revisao", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]),
    ]);

    // ── Build lookup maps ──
    const gamMap = new Map((gamRes.data || []).map((g: any) => [g.user_id, g]));

    // Latest approval score per user
    const approvalMap = new Map<string, any>();
    for (const a of (approvalRes.data || [])) {
      if (!approvalMap.has(a.user_id)) approvalMap.set(a.user_id, a);
    }

    // Previous approval scores for trend (second most recent)
    const prevApprovalMap = new Map<string, any>();
    const seenFirst = new Set<string>();
    for (const a of (approvalRes.data || [])) {
      if (!seenFirst.has(a.user_id)) { seenFirst.add(a.user_id); continue; }
      if (!prevApprovalMap.has(a.user_id)) prevApprovalMap.set(a.user_id, a);
    }

    const planMap = new Map((plansRes.data || []).map((p: any) => [p.user_id, p]));

    // Sim history aggregated
    const simMap = new Map<string, number[]>();
    for (const s of (simHistRes.data || [])) {
      if (!simMap.has(s.user_id)) simMap.set(s.user_id, []);
      simMap.get(s.user_id)!.push(s.final_score || 0);
    }

    // Anamnesis aggregated
    const anamMap = new Map<string, number[]>();
    for (const a of (anamRes.data || [])) {
      if (!anamMap.has(a.user_id)) anamMap.set(a.user_id, []);
      anamMap.get(a.user_id)!.push(a.final_score || 0);
    }

    // Reviews discipline
    const reviewMap = new Map<string, { total: number; completed: number }>();
    for (const r of (reviewsRes.data || [])) {
      if (!reviewMap.has(r.user_id)) reviewMap.set(r.user_id, { total: 0, completed: 0 });
      const entry = reviewMap.get(r.user_id)!;
      entry.total++;
      if (r.status === "concluida") entry.completed++;
    }

    // ── Previous snapshots for delta ──
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const { data: prevSnapshots } = await admin
      .from("ranking_snapshots")
      .select("user_id, consistency_rank, evolution_rank, performance_rank, practical_rank")
      .eq("snapshot_date", yesterday);
    const prevRankMap = new Map((prevSnapshots || []).map((s: any) => [s.user_id, s]));

    // ── Compute composite scores ──
    const scores: Array<{
      user_id: string;
      consistency_score: number;
      evolution_score: number;
      performance_score: number;
      practical_score: number;
    }> = [];

    for (const uid of userIds) {
      const gam = gamMap.get(uid);
      const approval = approvalMap.get(uid);
      const prevApproval = prevApprovalMap.get(uid);
      const plan = planMap.get(uid);
      const reviews = reviewMap.get(uid);

      // 1. Consistency: streak (40%) + mission completion (30%) + review discipline (30%)
      const streak = gam?.current_streak || 0;
      const streakScore = Math.min(streak * 5, 100); // 20 days = 100
      const planCompletion = plan && plan.total_blocks > 0
        ? (plan.completed_count / plan.total_blocks) * 100 : 0;
      const reviewDiscipline = reviews && reviews.total > 0
        ? (reviews.completed / reviews.total) * 100 : 0;
      const consistency_score = Math.round(streakScore * 0.4 + planCompletion * 0.3 + reviewDiscipline * 0.3);

      // 2. Evolution: improvement trend (approval score delta + weekly xp growth)
      const currentScore = approval?.score || 0;
      const prevScore = prevApproval?.score || currentScore;
      const scoreDelta = currentScore - prevScore;
      const improvementNorm = Math.min(Math.max(scoreDelta + 50, 0), 100); // -50 to +50 mapped to 0-100
      const weeklyXp = gam?.weekly_xp || 0;
      const weeklyXpNorm = Math.min(weeklyXp / 5, 100); // 500 xp = 100
      const evolution_score = Math.round(improvementNorm * 0.6 + weeklyXpNorm * 0.4);

      // 3. Performance: approval score (60%) + accuracy (40%)
      const approvalScore = approval?.score || 0;
      const accuracy = approval?.accuracy || 0;
      const performance_score = Math.round(approvalScore * 0.6 + accuracy * 0.4);

      // 4. Practical: simulation avg (50%) + anamnesis avg (50%)
      const simScores = simMap.get(uid) || [];
      const anamScores = anamMap.get(uid) || [];
      const simAvg = simScores.length > 0 ? simScores.reduce((a, b) => a + b, 0) / simScores.length : 0;
      const anamAvg = anamScores.length > 0 ? anamScores.reduce((a, b) => a + b, 0) / anamScores.length : 0;
      const hasPractical = simScores.length > 0 || anamScores.length > 0;
      const practical_score = hasPractical
        ? Math.round((simScores.length > 0 ? simAvg * 0.5 : 0) + (anamScores.length > 0 ? anamAvg * 0.5 : 0))
          / (simScores.length > 0 && anamScores.length > 0 ? 1 : 0.5) // normalize if only one source
        : 0;

      scores.push({
        user_id: uid,
        consistency_score: Math.max(0, Math.min(100, consistency_score)),
        evolution_score: Math.max(0, Math.min(100, evolution_score)),
        performance_score: Math.max(0, Math.min(100, performance_score)),
        practical_score: Math.max(0, Math.min(100, Math.round(practical_score))),
      });
    }

    // ── Compute ranks per category ──
    const rankBy = (key: string) => {
      const sorted = [...scores].sort((a, b) => (b as any)[key] - (a as any)[key]);
      const rankMap = new Map<string, number>();
      sorted.forEach((s, i) => rankMap.set(s.user_id, i + 1));
      return rankMap;
    };

    const cRanks = rankBy("consistency_score");
    const eRanks = rankBy("evolution_score");
    const pRanks = rankBy("performance_score");
    const prRanks = rankBy("practical_score");
    const totalUsers = scores.length;

    // ── Upsert snapshots ──
    const rows = scores.map((s) => {
      const prev = prevRankMap.get(s.user_id);
      const cRank = cRanks.get(s.user_id)!;
      const eRank = eRanks.get(s.user_id)!;
      const pRank = pRanks.get(s.user_id)!;
      const prRank = prRanks.get(s.user_id)!;

      return {
        user_id: s.user_id,
        snapshot_date: today,
        consistency_score: s.consistency_score,
        evolution_score: s.evolution_score,
        performance_score: s.performance_score,
        practical_score: s.practical_score,
        consistency_rank: cRank,
        evolution_rank: eRank,
        performance_rank: pRank,
        practical_rank: prRank,
        consistency_rank_delta: prev ? (prev.consistency_rank || cRank) - cRank : 0,
        evolution_rank_delta: prev ? (prev.evolution_rank || eRank) - eRank : 0,
        performance_rank_delta: prev ? (prev.performance_rank || pRank) - pRank : 0,
        practical_rank_delta: prev ? (prev.practical_rank || prRank) - prRank : 0,
        percentile: totalUsers > 0 ? Math.round(((totalUsers - pRank) / totalUsers) * 100) : 50,
        details_json: {},
      };
    });

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await admin
        .from("ranking_snapshots")
        .upsert(batch, { onConflict: "user_id,snapshot_date" });
      if (error) console.error("Upsert error:", error);
    }

    return new Response(
      JSON.stringify({ ok: true, processed: rows.length, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("calculate-rankings error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
