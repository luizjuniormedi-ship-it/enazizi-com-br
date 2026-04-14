/**
 * validate-medical-image-ai — Single-image AI validation via Gemini Vision.
 * Input: { image_url: string }
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
    const imageUrl = body.image_url;
    if (!imageUrl || typeof imageUrl !== "string") {
      return json({ error: "image_url is required" }, 400);
    }

    // Optional: also update asset in DB
    const assetId = body.asset_id as string | undefined;

    const result = await classifyImage(imageUrl, LOVABLE_API_KEY);

    // If asset_id provided, update the asset record
    if (assetId) {
      try {
        const db = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const updateData: Record<string, unknown> = {
          ai_validated: result.is_medical && result.confidence >= 0.7,
          ai_confidence: result.confidence,
          ai_type: result.type,
        };
        // Deactivate non-medical images
        if (!result.is_medical || result.confidence < 0.7) {
          updateData.is_active = false;
          updateData.integrity_status = "ai_rejected";
        }
        await db
          .from("medical_image_assets")
          .update(updateData)
          .eq("id", assetId);
      } catch (e) {
        console.error("[validate-medical-image-ai] DB update failed:", e);
      }
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

async function classifyImage(
  imageUrl: string,
  apiKey: string,
): Promise<{
  is_medical: boolean;
  type: string;
  confidence: number;
  description: string;
}> {
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
    return {
      is_medical: false,
      type: "unknown",
      confidence: 0,
      description: "Could not parse AI response",
    };
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
    return {
      is_medical: false,
      type: "unknown",
      confidence: 0,
      description: "JSON parse error",
    };
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
