/**
 * validate-medical-image-ai — Single-image AI validation via OpenAI Vision.
 * Supports single image, batch mode, and retroactive audit.
 * Sets quality_gate_passed and logs to asset_quality_audit_logs.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** URL patterns that indicate non-clinical images */
const BLOCKED_URL_TERMS = [
  "mockup", "screenshot", "placeholder", "laptop", "dashboard",
  "notebook", "landing-page", "wireframe", "template", "stock-photo",
  "stockphoto", "infographic", "hero-image", "banner-image",
  "certificate", "badge-image", "logo", "branding", "team-photo",
  "about-us", "staff-photo", "corporate", "portrait", "selfie",
  "headshot", "avatar", "profile-photo", "profile-pic", "face-photo",
  "icon-", "emoji", "sticker", "clipart", "cartoon", "illustration",
  "vector", "flat-design", "shutterstock", "gettyimages", "istockphoto",
  "dreamstime", "unsplash.com", "pexels.com", "pixabay.com",
  "youtube.com", "vimeo.com", "algoscope", "generic", "monitor",
  "computer", "desktop", "phone", "favicon", "thumbnail",
];

function isUrlSuspicious(url: string): string | null {
  const lower = url.toLowerCase();
  for (const term of BLOCKED_URL_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json().catch(() => ({}));

    // ── Retroactive audit mode ──
    if (body.audit === true) {
      return await handleAudit(LOVABLE_API_KEY);
    }

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

    // Pre-check URL
    const suspiciousTerm = isUrlSuspicious(imageUrl);
    if (suspiciousTerm) {
      const result = { is_medical: false, type: "not_medical", confidence: 0, description: `URL blocked: contains "${suspiciousTerm}"` };
      if (assetId) {
        await rejectAsset(assetId, `URL suspeita: "${suspiciousTerm}"`, "url_filter");
      }
      return json(result);
    }

    const result = await classifyImage(imageUrl, LOVABLE_API_KEY);

    if (assetId) {
      await processAssetResult(assetId, result, "ai_validation");
    }

    return json(result);
  } catch (e) {
    console.error("[validate-medical-image-ai]", e);
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

// ── Retroactive audit: check ALL active assets ──
async function handleAudit(apiKey: string) {
  const db = getDb();
  const { data: assets, error } = await db
    .from("medical_image_assets")
    .select("id, image_url, image_type, diagnosis, ai_validated, integrity_status, validation_level, clinical_confidence")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return json({ error: error.message }, 500);
  if (!assets || assets.length === 0) return json({ processed: 0, message: "No active assets" });

  let approved = 0, rejected = 0, processed = 0;
  const rejections: { id: string; reason: string }[] = [];

  for (const asset of assets) {
    processed++;

    // 1. URL check
    const suspiciousTerm = isUrlSuspicious(asset.image_url || "");
    if (suspiciousTerm) {
      await rejectAsset(asset.id, `URL suspeita: "${suspiciousTerm}"`, "retroactive_audit");
      rejected++;
      rejections.push({ id: asset.id, reason: `URL: ${suspiciousTerm}` });
      continue;
    }

    // 2. Basic metadata check
    if (!asset.image_url || asset.image_url.trim().length < 10) {
      await rejectAsset(asset.id, "URL de imagem ausente ou inválida", "retroactive_audit");
      rejected++;
      rejections.push({ id: asset.id, reason: "URL inválida" });
      continue;
    }

    // 3. If already AI validated and passed, just set gate
    if (asset.ai_validated === true && asset.integrity_status === "ok" && (asset.clinical_confidence || 0) >= 0.8) {
      await approveAsset(asset.id, "retroactive_audit", asset.clinical_confidence);
      approved++;
      continue;
    }

    // 4. Run AI validation
    try {
      const result = await classifyImage(asset.image_url, apiKey);
      await processAssetResult(asset.id, result, "retroactive_audit");
      if (result.is_medical && result.confidence >= 0.7) approved++;
      else {
        rejected++;
        rejections.push({ id: asset.id, reason: result.description });
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`[audit] Asset ${asset.id} failed:`, e);
    }
  }

  return json({ processed, approved, rejected, rejections: rejections.slice(0, 20) });
}

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

  let processed = 0, blocked = 0;

  for (const asset of assets) {
    try {
      // Pre-check URL
      const suspiciousTerm = isUrlSuspicious(asset.image_url || "");
      if (suspiciousTerm) {
        await rejectAsset(asset.id, `URL suspeita: "${suspiciousTerm}"`, "url_filter");
        processed++;
        blocked++;
        continue;
      }

      const result = await classifyImage(asset.image_url, apiKey);
      await processAssetResult(asset.id, result, "ai_validation");
      processed++;
      if (!result.is_medical || result.confidence < 0.7) blocked++;
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`[batch] Asset ${asset.id} failed:`, e);
    }
  }

  return json({ processed, blocked, total: assets.length });
}

async function processAssetResult(assetId: string, result: ClassifyResult, source: string) {
  const db = getDb();
  const passed = result.is_medical && result.confidence >= 0.7;

  const updateData: Record<string, unknown> = {
    ai_validated: passed,
    ai_confidence: result.confidence,
    ai_type: result.type,
    quality_gate_passed: passed,
  };

  if (!passed) {
    updateData.is_active = false;
    updateData.integrity_status = "ai_rejected";
    updateData.rejection_reason = result.description || "AI validation failed";
    updateData.quality_gate_passed = false;
  }

  await db.from("medical_image_assets").update(updateData).eq("id", assetId);

  // Audit log
  await db.from("asset_quality_audit_logs").insert({
    asset_id: assetId,
    image_type: result.type,
    status: passed ? "approved" : "rejected",
    rejection_reason: passed ? null : (result.description || "AI rejected"),
    clinical_match_score: result.confidence,
    gate_source: source,
    details: { is_medical: result.is_medical, type: result.type, confidence: result.confidence },
  });
}

async function rejectAsset(assetId: string, reason: string, source: string) {
  const db = getDb();
  await db.from("medical_image_assets").update({
    is_active: false,
    quality_gate_passed: false,
    rejection_reason: reason,
    ai_validated: false,
  }).eq("id", assetId);

  await db.from("asset_quality_audit_logs").insert({
    asset_id: assetId,
    status: "rejected",
    rejection_reason: reason,
    gate_source: source,
  });

  // Also move any published questions to draft
  await db.from("medical_image_questions").update({ status: "draft" }).eq("asset_id", assetId);
}

async function approveAsset(assetId: string, source: string, confidence?: number | null) {
  const db = getDb();
  await db.from("medical_image_assets").update({ quality_gate_passed: true }).eq("id", assetId);
  await db.from("asset_quality_audit_logs").insert({
    asset_id: assetId,
    status: "approved",
    clinical_match_score: confidence,
    gate_source: source,
  });
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
