/**
 * validate-medical-image-ai — Single-image AI validation via Gemini Vision.
 * Supports single image and batch mode for auto-validation pipeline.
 * Input: { image_url: string, asset_id?: string } OR { batch: true } for auto-scan
 * Output: { is_medical: boolean, type: string, confidence: number, description: string }
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

    const body = await req.json().catch(() => ({}));

    // ── Batch mode: scan unvalidated assets ──
    if (body.batch === true) {
      return await handleBatch(LOVABLE_API_KEY);
    }

    // ── Single image mode ──
    const imageUrl = body.image_url;
    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "image_url is required" }, 400);
    }

    const assetId = body.asset_id as string | undefined;
    const result = await classifyImage(imageUrl, LOVABLE_API_KEY);

    if (assetId) {
      await updateAsset(assetId, result);
      await logTelemetry("image_ai_validated", "validate-medical-image-ai", {
        asset_id: assetId,
        is_medical: result.is_medical,
        confidence: result.confidence,
        type: result.type,
        blocked: !result.is_medical || result.confidence < 0.7,
      });
    }

    return json(result);
  } catch (e) {
    console.error("[validate-medical-image-ai]", e);
    return json(
      { error: e instanceof Error ? e.message : "Internal error" },
      500,
    );
  }
});

// ── Batch: scan up to 20 unvalidated active assets ──
async function handleBatch(apiKey: string) {
  const db = getDb();
  const { data: assets, error } = await db
    .from("medical_image_assets")
    .select("id, image_url")
    .eq("is_active", true)
    .is("ai_validated", null)
    .limit(20);

  if (error) return json({ error: error.message }, 500);
  if (!assets || assets.length === 0) return json({ processed: 0, message: "No unvalidated assets" });

  let processed = 0;
  let blocked = 0;

  for (const asset of assets) {
    try {
      const result = await classifyImage(asset.image_url, apiKey);
      await updateAsset(asset.id, result);
      processed++;
      if (!result.is_medical || result.confidence < 0.7) blocked++;

      await logTelemetry("image_ai_batch_validated", "validate-medical-image-ai", {
        asset_id: asset.id,
        is_medical: result.is_medical,
        confidence: result.confidence,
        blocked: !result.is_medical || result.confidence < 0.7,
      });

      // Rate limit: 1s between calls
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`[batch] Asset ${asset.id} failed:`, e);
    }
  }

  return json({ processed, blocked, total: assets.length });
}

async function updateAsset(assetId: string, result: ClassifyResult) {
  const db = getDb();
  const updateData: Record<string, unknown> = {
    ai_validated: result.is_medical && result.confidence >= 0.7,
    ai_confidence: result.confidence,
    ai_type: result.type,
  };
  if (!result.is_medical || result.confidence < 0.7) {
    updateData.is_active = false;
    updateData.integrity_status = "ai_rejected";
  }
  await db.from("medical_image_assets").update(updateData).eq("id", assetId);
}

async function logTelemetry(eventType: string, module: string, details: Record<string, unknown>) {
  try {
    const db = getDb();
    await db.from("automation_telemetry").insert({ event_type: eventType, module, details });
  } catch (e) {
    console.error("[telemetry]", e);
  }
}

interface ClassifyResult {
  is_medical: boolean;
  type: string;
  confidence: number;
  description: string;
}

async function classifyImage(imageUrl: string, apiKey: string): Promise<ClassifyResult> {
  const prompt = `You are a medical image classifier. Analyze the image at this URL and determine:
1. Is this a genuine medical/clinical image? (NOT a logo, screenshot, stock photo, diagram, placeholder, portrait, laptop, banner, or UI element)
2. What type of medical image? (ecg, xray, ct, mri, us, dermatology, ophthalmology, pathology, other, not_medical)
3. Confidence level (0.0 to 1.0)
4. Brief description

Image URL: ${imageUrl}

Return ONLY valid JSON:
{"is_medical": true/false, "type": "ecg|xray|ct|mri|us|dermatology|ophthalmology|pathology|other|not_medical", "confidence": 0.0-1.0, "description": "brief description"}`;

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    },
  );

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limited");
    if (resp.status === 402) throw new Error("Credits exhausted");
    throw new Error(`AI gateway error: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return { is_medical: false, type: "unknown", confidence: 0, description: "Could not parse AI response" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      is_medical: parsed.is_medical === true,
      type: parsed.type || "unknown",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      description: parsed.description || "",
    };
  } catch {
    return { is_medical: false, type: "unknown", confidence: 0, description: "JSON parse error" };
  }
}

function getDb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
