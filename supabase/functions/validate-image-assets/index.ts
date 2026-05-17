/**
 * validate-image-assets — AI-powered validation of medical image assets.
 * Uses Lovable AI (OpenAI) vision via Gateway to determine if an asset is genuinely medical.
 * Processes a batch of unvalidated assets and stores results.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size ?? 10, 20);

    // Find assets that haven't been validated yet
    const { data: assets, error: fetchErr } = await db
      .from("medical_image_assets")
      .select("id, image_url, image_type, diagnosis, specialty, is_active")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!assets || assets.length === 0) {
      return jsonResp({ success: true, message: "No assets to validate", processed: 0 });
    }

    // Filter out already-validated assets
    const assetIds = assets.map((a: any) => a.id);
    const { data: existing } = await db
      .from("asset_validation_results")
      .select("asset_id")
      .in("asset_id", assetIds);
    const alreadyDone = new Set((existing || []).map((e: any) => e.asset_id));
    const toValidate = assets.filter((a: any) => !alreadyDone.has(a.id));

    if (toValidate.length === 0) {
      return jsonResp({ success: true, message: "All assets already validated", processed: 0 });
    }

    const results: any[] = [];

    for (const asset of toValidate) {
      try {
        const validation = await validateWithAI(asset, LOVABLE_API_KEY);

        // Save result
        await db.from("asset_validation_results").insert({
          asset_id: asset.id,
          is_medical_image: validation.is_medical,
          detected_image_type: validation.detected_type,
          clinical_match_score: validation.clinical_match,
          quality_score: validation.quality,
          validation_status: validation.status,
          validation_reason: validation.reason,
          model_used: "google/gemini-2.5-flash",
        });

        // If invalid, deactivate asset
        if (validation.status === "invalid") {
          await db
            .from("medical_image_assets")
            .update({ is_active: false, integrity_status: "ai_rejected" })
            .eq("id", asset.id);
        }

        results.push({ asset_id: asset.id, ...validation });
      } catch (err) {
        console.error(`[validate] Asset ${asset.id} failed:`, err);
        results.push({ asset_id: asset.id, status: "error", reason: String(err) });
      }
    }

    return jsonResp({
      success: true,
      processed: results.length,
      valid: results.filter((r) => r.status === "valid").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      needs_review: results.filter((r) => r.status === "needs_review").length,
      errors: results.filter((r) => r.status === "error").length,
    });
  } catch (e) {
    console.error("[validate-image-assets]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function validateWithAI(
  asset: any,
  apiKey: string
): Promise<{
  is_medical: boolean;
  detected_type: string;
  clinical_match: number;
  quality: number;
  status: "valid" | "invalid" | "needs_review";
  reason: string;
}> {
  const prompt = `You are a medical image quality auditor. Analyze the image at this URL and answer in JSON only.

Image URL: ${asset.image_url}
Declared type: ${asset.image_type || "unknown"}
Declared diagnosis: ${asset.diagnosis || "unknown"}
Specialty: ${asset.specialty || "unknown"}

Evaluate:
1. Is this a genuine medical/clinical image? (not a logo, screenshot, stock photo, diagram, placeholder, portrait, or UI element)
2. What type of medical image is it? (ecg, xray, ct, us, dermatology, ophthalmology, pathology, or other)
3. Does it match the declared type and diagnosis?
4. Clinical/pedagogical quality (0-100)

Return ONLY valid JSON:
{
  "is_medical": true/false,
  "detected_type": "ecg|xray|ct|us|dermatology|ophthalmology|pathology|other|not_medical",
  "clinical_match": 0-100,
  "quality": 0-100,
  "reason": "brief explanation"
}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limited");
    if (resp.status === 402) throw new Error("Credits exhausted");
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      is_medical: false,
      detected_type: "unknown",
      clinical_match: 0,
      quality: 0,
      status: "needs_review",
      reason: "AI response could not be parsed",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const isMedical = parsed.is_medical === true;
    const clinicalMatch = Number(parsed.clinical_match) || 0;
    const quality = Number(parsed.quality) || 0;

    let status: "valid" | "invalid" | "needs_review";
    if (!isMedical || parsed.detected_type === "not_medical") {
      status = "invalid";
    } else if (clinicalMatch < 50 || quality < 40) {
      status = "needs_review";
    } else {
      status = "valid";
    }

    return {
      is_medical: isMedical,
      detected_type: parsed.detected_type || "unknown",
      clinical_match: clinicalMatch,
      quality,
      status,
      reason: parsed.reason || "",
    };
  } catch {
    return {
      is_medical: false,
      detected_type: "unknown",
      clinical_match: 0,
      quality: 0,
      status: "needs_review",
      reason: "JSON parse error in AI response",
    };
  }
}

function jsonResp(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
