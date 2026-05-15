import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_QUESTIONS_PER_ASSET = 3;
const BATCH_SIZE = 3;
const EXECUTION_TIMEOUT_MS = 120_000;
import { isUrlSuspicious, validateImageVision } from "../_shared/vision-gate.ts";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const executionStart = Date.now();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { force_asset_id } = await req.json().catch(() => ({}));
    let allAssets = [];

    if (force_asset_id) {
      const { data } = await sb.from("medical_image_assets").select("*").eq("id", force_asset_id);
      allAssets = data || [];
    } else {
      const { data } = await sb.from("medical_image_assets")
        .select("*")
        .eq("is_active", true)
        .eq("review_status", "published")
        .gte("clinical_confidence", 0.9)
        .limit(10);
      allAssets = data || [];
    }

    if (!allAssets.length) return new Response(JSON.stringify({ success: true, message: "Nenhum asset" }), { headers: corsHeaders });

    const run = await sb.from("question_generation_runs").insert({
      run_type: force_asset_id ? "manual_test" : "auto_image_batch",
      status: "running",
      target_assets: allAssets.length,
      started_at: new Date().toISOString(),
    }).select("id").single();

    let totalGenerated = 0;
    let totalFailed = 0;

    for (const asset of allAssets) {
      const visionCheck = await validateImageVision(asset.image_url, asset.diagnosis, asset.image_type, LOVABLE_API_KEY);
      if (!visionCheck.valid) {
        totalFailed++;
        continue;
      }

      const prompt = `Gere 1 questão médica em pt-BR sobre: ${asset.diagnosis}.
      Retorne APENAS JSON: {"statement":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","option_e":"...","correct_index":0,"explanation":"...","rationale_map":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"difficulty":"medium","exam_style":"USP"}`;

      const response = await aiFetch({
        messages: [{ role: "user", content: prompt }],
        model: "openai/gpt-5-mini",
        max_completion_tokens: 2000,
        response_format: { type: "json_object" }
      });

      if (response.ok) {
        const aiData = await response.json();
        const q = parseAiJson(aiData.choices[0].message.content);
        await sb.from("medical_image_questions").insert({
          asset_id: asset.id,
          statement: q.statement,
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, option_e: q.option_e,
          correct_index: q.correct_index,
          explanation: q.explanation,
          rationale_map: q.rationale_map,
          status: "published",
          version: 1
        });
        totalGenerated++;
      } else {
        totalFailed++;
      }
    }

    await sb.from("question_generation_runs").update({
      status: "completed",
      finished_at: new Date().toISOString(),
      generated_questions: totalGenerated,
      failed_assets: totalFailed
    }).eq("id", run.data.id);

    return new Response(JSON.stringify({ success: true, generated: totalGenerated, failed: totalFailed }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});
