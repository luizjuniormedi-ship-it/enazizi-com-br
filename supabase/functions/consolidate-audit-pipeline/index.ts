const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const BATCH_SIZE = 10;
    let totalAudited = 0;
    let totalExcellent = 0;
    let totalGood = 0;
    let totalWeak = 0;
    let totalDowngraded = 0;
    let totalRegenerated = 0;
    let hasMore = true;

    // Phase 1: Audit all unaudited published questions in batches
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from("medical_image_questions")
        .select(`
          id, statement, option_a, option_b, option_c, option_d, option_e,
          correct_index, explanation, difficulty, exam_style,
          senior_audit_score, editorial_grade,
          medical_image_assets!inner(
            image_type, diagnosis, clinical_findings, image_url,
            clinical_confidence, review_status, is_active
          )
        `)
        .eq("status", "published")
        .is("senior_audit_score", null)
        .eq("medical_image_assets.is_active", true)
        .limit(BATCH_SIZE);

      if (error) throw error;
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      // Call audit edge function in batch mode for each question
      for (const q of batch as any[]) {
        try {
          const auditRes = await fetch(`${SUPABASE_URL}/functions/v1/audit-multimodal-pedagogical`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              asset: q.medical_image_assets,
              question: {
                statement: q.statement,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                option_e: q.option_e,
                correct_index: q.correct_index,
                explanation: q.explanation,
                difficulty: q.difficulty,
                exam_style: q.exam_style,
              },
              question_id: q.id,
              mode: "single",
            }),
          });

          if (!auditRes.ok) {
            console.error(`Audit failed for ${q.id}: ${auditRes.status}`);
            continue;
          }

          const result = await auditRes.json();
          totalAudited++;

          if (result.status === "approved") {
            const score = result.final_score ?? 0;
            if (score >= 90) totalExcellent++;
            else totalGood++;
          } else if (result.status === "needs_improvement") {
            totalGood++;
          } else if (result.status === "rejected") {
            totalWeak++;
            totalDowngraded++;

            // Phase 2: Try regeneration for rejected questions
            try {
              const regenRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-image-questions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  asset_id: q.asset_id || q.id,
                  regenerate_for: q.id,
                }),
              });

              if (regenRes.ok) {
                totalRegenerated++;
                console.log(`Regenerated question for asset of ${q.id}`);
              }
            } catch (e) {
              console.error(`Regeneration failed for ${q.id}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error auditing ${q.id}:`, e);
        }
      }

      // If we got fewer than BATCH_SIZE, we're done
      if (batch.length < BATCH_SIZE) hasMore = false;
    }

    // Phase 3: Get final counts
    const { data: summary } = await supabase
      .from("medical_image_questions")
      .select("editorial_grade, status")
      .in("status", ["published", "needs_review"]);

    const counts = {
      excellent: 0,
      good: 0,
      weak: 0,
    };

    for (const row of (summary || []) as any[]) {
      if (row.status === "published") {
        if (row.editorial_grade === "excellent") counts.excellent++;
        else if (row.editorial_grade === "good") counts.good++;
      }
      if (row.editorial_grade === "weak" || row.status === "needs_review") counts.weak++;
    }

    const report = {
      total_audited_this_run: totalAudited,
      total_excellent: counts.excellent,
      total_good: counts.good,
      total_weak: counts.weak,
      total_downgraded: totalDowngraded,
      total_regenerated: totalRegenerated,
      message: "A auditoria pedagógica multimodal foi consolidada no fluxo principal do ENAZIZI, permitindo servir apenas questões multimodais com real valor de prova.",
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Pipeline error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
