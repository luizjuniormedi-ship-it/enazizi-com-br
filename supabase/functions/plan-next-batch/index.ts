import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Gap Analysis (server-side) ──
async function computeGaps(imageType: string) {
  const { data: raw } = await sb.rpc("compute_content_gaps", { p_image_type: imageType });
  return raw || {};
}

// ── Student weakness aggregation ──
async function getWeaknessData(imageType: string) {
  const { data } = await sb
    .from("visual_skill_snapshots")
    .select("image_type, accuracy, attempts_count")
    .eq("image_type", imageType)
    .eq("weakest_area", true);

  if (!data || data.length === 0) return { avg_accuracy: 0.5, total_students: 0 };

  const totalAttempts = data.reduce((s: number, d: any) => s + (d.attempts_count || 0), 0);
  const weightedAcc = data.reduce((s: number, d: any) => s + (d.accuracy || 0) * (d.attempts_count || 1), 0);
  return {
    avg_accuracy: totalAttempts > 0 ? weightedAcc / totalAttempts : 0.5,
    total_students: data.length,
  };
}

// ── Priority scoring ──
function scoreItem(
  diagnosis: string,
  difficulty: string,
  examWeight: number,
  currentCount: number,
  config: any,
  gaps: any,
  weakness: { avg_accuracy: number },
) {
  // Exam relevance (0-100)
  const examScore = examWeight * 10;

  // Gap score (0-100)
  let gapScore = 0;
  if (currentCount === 0) gapScore = 100;
  else if (currentCount < (config.min_assets_per_diagnosis || 3)) gapScore = 80;
  else if (currentCount >= (config.max_assets_per_diagnosis || 15)) gapScore = 0;
  else gapScore = Math.max(0, 60 - currentCount * 5);

  const diffDist = gaps.difficulty_distribution || {};
  const total = (gaps.total_assets || 0) + 1;
  const targets = config.difficulty_targets || { easy: 0.25, medium: 0.4, hard: 0.35 };
  if (difficulty === "easy" && (diffDist.easy || 0) < total * targets.easy) gapScore += 15;
  if (difficulty === "medium" && (diffDist.medium || 0) < total * targets.medium) gapScore += 10;
  if (difficulty === "hard" && (diffDist.hard || 0) < total * targets.hard) gapScore += 10;

  // Weakness score (0-100)
  const weaknessScore = Math.max(0, Math.round((1 - weakness.avg_accuracy) * 100));

  const wExam = Number(config.weight_exam_relevance) || 0.4;
  const wGap = Number(config.weight_inventory_gap) || 0.25;
  const wWeak = Number(config.weight_student_weakness) || 0.35;

  const composite = Math.round(examScore * wExam + gapScore * wGap + weaknessScore * wWeak);

  const reasons: string[] = [];
  if (examScore >= 80) reasons.push("alta relevância de prova");
  if (gapScore >= 80) reasons.push("sub-representado no banco");
  if (weaknessScore >= 60) reasons.push("fraqueza frequente dos alunos");
  if (currentCount >= (config.max_assets_per_diagnosis || 15)) reasons.push("saturado");

  return {
    diagnosis,
    difficulty,
    priority_score: Math.min(100, Math.max(0, composite)),
    reason: reasons.join("; ") || "prioridade padrão",
    components: { exam_score: examScore, gap_score: gapScore, weakness_score: weaknessScore },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const imageType = body.image_type || "xray";
    const batchSize = Math.min(body.batch_size || 10, 30);

    // 1. Load config
    const { data: config } = await sb
      .from("import_priority_config")
      .select("*")
      .eq("image_type", imageType)
      .eq("is_active", true)
      .single();

    if (!config) {
      return new Response(JSON.stringify({ error: `No config for ${imageType}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Compute gaps
    const gaps = await computeGaps(imageType);
    const diagDist = (gaps.diagnosis_distribution || []) as any[];
    const diagMap: Record<string, number> = {};
    for (const d of diagDist) diagMap[d.diagnosis?.toLowerCase()] = d.count || 0;

    // 3. Student weakness
    const weakness = await getWeaknessData(imageType);

    // 4. Score all candidates
    const rankings = config.diagnosis_rankings as any[];
    const difficulties = ["easy", "medium", "hard"];
    const allItems: any[] = [];

    for (const r of rankings) {
      for (const diff of difficulties) {
        const count = diagMap[r.diagnosis?.toLowerCase()] || 0;
        const item = scoreItem(r.diagnosis, diff, r.exam_weight || 5, count, config, gaps, weakness);
        if (item.priority_score > 0) {
          allItems.push({ ...item, image_type: imageType });
        }
      }
    }

    allItems.sort((a, b) => b.priority_score - a.priority_score);

    // 5. Select top batch (max 2 per diagnosis)
    const selected: any[] = [];
    const diagCount: Record<string, number> = {};
    for (const item of allItems) {
      if (selected.length >= batchSize) break;
      const k = item.diagnosis;
      if ((diagCount[k] || 0) >= 2) continue;
      selected.push(item);
      diagCount[k] = (diagCount[k] || 0) + 1;
    }

    // 6. Save gap report
    const missingDiagnoses = rankings
      .filter((r: any) => !diagMap[r.diagnosis?.toLowerCase()])
      .map((r: any) => r.diagnosis);

    const saturated = diagDist
      .filter(d => (d.count || 0) >= (config.max_assets_per_diagnosis || 15))
      .map(d => d.diagnosis);

    await sb.from("content_gap_reports").insert({
      image_type: imageType,
      report_json: gaps,
      missing_diagnoses: missingDiagnoses,
      saturated_diagnoses: saturated,
      difficulty_gaps: gaps.difficulty_distribution || {},
      weakness_influenced: [{ ...weakness, image_type: imageType }],
      next_batch_recommendation: selected,
      priority_mode: config.priority_mode || "hybrid",
    });

    return new Response(JSON.stringify({
      status: "ok",
      image_type: imageType,
      priority_mode: config.priority_mode,
      batch: selected,
      gap_summary: {
        total_assets: gaps.total_assets,
        total_questions: gaps.total_questions,
        missing_diagnoses: missingDiagnoses.length,
        saturated: saturated.length,
        difficulty: gaps.difficulty_distribution,
        student_weakness: weakness,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[plan-next-batch]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
