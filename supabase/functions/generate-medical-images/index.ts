import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_PROMPTS: Record<string, (diagnosis: string, findings: string[]) => string> = {
  ecg: (diagnosis, findings) =>
    `High-quality 12-lead ECG strip on white graph paper showing ${diagnosis}. Clinical findings: ${findings.join(", ")}. Clear grid lines, proper lead labels (I, II, III, aVR, aVL, aVF, V1-V6), realistic waveform morphology. Medical textbook quality, clean white background, no text annotations except lead labels. Horizontal format.`,
  xray: (diagnosis, findings) =>
    `High-quality PA chest X-ray radiograph showing ${diagnosis}. Findings: ${findings.join(", ")}. Proper radiographic density, clear lung fields, visible cardiac silhouette, proper bone contrast. Medical textbook quality, standard radiographic appearance on black background. Portrait format.`,
  dermatology: (diagnosis, findings) =>
    `Clinical dermatology photograph showing ${diagnosis}. Visible findings: ${findings.join(", ")}. Well-lit clinical photograph, appropriate skin area visible, diagnostic morphology clearly shown. Medical textbook quality, neutral background, proper clinical photography lighting. Close-up view.`,
  ct: (diagnosis, findings) =>
    `High-quality axial CT scan image showing ${diagnosis}. Findings: ${findings.join(", ")}. Proper Hounsfield unit windowing, clear anatomical structures, appropriate soft tissue or bone window. Medical textbook quality, standard DICOM-style grayscale appearance on black background. Axial cross-section view with proper anatomical orientation markers.`,
  us: (diagnosis, findings) =>
    `High-quality ultrasound image showing ${diagnosis}. Findings: ${findings.join(", ")}. Proper grayscale echotexture, appropriate gain settings, visible anatomical landmarks, sector or linear probe appearance. Medical textbook quality, standard ultrasound display with depth markers on dark background.`,
  pathology: (diagnosis, findings) =>
    `High-quality histopathology microscope image showing ${diagnosis}. Findings: ${findings.join(", ")}. H&E staining, proper magnification showing cellular detail, clear tissue architecture. Medical textbook quality, bright field microscopy appearance with proper color balance. High resolution detail.`,
  ophthalmology: (diagnosis, findings) =>
    `High-quality fundoscopy image showing ${diagnosis}. Findings: ${findings.join(", ")}. Clear view of optic disc, macula and retinal vessels, proper red reflex background, diagnostic features clearly visible. Medical textbook quality, standard ophthalmoscopic circular field view.`,
};

interface GenerateRequest {
  image_type: string;
  batch_size?: number;
  asset_ids?: string[];
}

async function generateMedicalImage(prompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("AI response error:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imageUrl || null;
  } catch (err) {
    console.error("AI generation error:", err);
    return null;
  }
}

async function uploadToStorage(
  base64Data: string,
  imageType: string,
  assetCode: string
): Promise<string | null> {
  try {
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));

    const safeCode = assetCode
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_");
    const filePath = `${imageType}/${safeCode}.png`;

    const { error } = await supabase.storage
      .from("question-images")
      .upload(filePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("question-images")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: GenerateRequest = await req.json();
    const { image_type, batch_size = 2, asset_ids } = body;

    if (!image_type || !IMAGE_PROMPTS[image_type]) {
      return new Response(
        JSON.stringify({ error: `image_type inválido. Use: ${Object.keys(IMAGE_PROMPTS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("medical_image_assets")
      .select("id, asset_code, diagnosis, clinical_findings, distractors, integrity_status")
      .eq("image_type", image_type)
      .eq("review_status", "blocked_clinical")
      .eq("is_active", false)
      .order("diagnosis")
      .limit(Math.min(batch_size, 5));

    if (asset_ids && asset_ids.length > 0) {
      query = query.in("id", asset_ids);
    }

    const { data: assets, error: fetchErr } = await query;
    if (fetchErr || !assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum asset bloqueado encontrado para este tipo", error: fetchErr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{
      asset_id: string;
      diagnosis: string;
      status: "success" | "failed";
      image_url?: string;
      error?: string;
    }> = [];

    for (const asset of assets) {
      try {
        const findings = Array.isArray(asset.clinical_findings)
          ? asset.clinical_findings
          : [];

        const promptFn = IMAGE_PROMPTS[image_type];
        const prompt = promptFn(asset.diagnosis, findings as string[]);

        console.log(`Generating image for: ${asset.diagnosis} (${asset.asset_code})`);

        const base64Image = await generateMedicalImage(prompt);
        if (!base64Image) {
          results.push({ asset_id: asset.id, diagnosis: asset.diagnosis, status: "failed", error: "AI generation returned null" });
          continue;
        }

        const publicUrl = await uploadToStorage(base64Image, image_type, asset.asset_code);
        if (!publicUrl) {
          results.push({ asset_id: asset.id, diagnosis: asset.diagnosis, status: "failed", error: "Storage upload failed" });
          continue;
        }

        const { error: updateErr } = await supabase
          .from("medical_image_assets")
          .update({
            image_url: publicUrl,
            thumbnail_url: publicUrl,
            clinical_confidence: 0.75,
            review_status: "needs_review",
            integrity_status: "pending",
            is_active: false,
            asset_origin: "ai_generated_v2",
            clinical_validation_notes: `Imagem ${image_type.toUpperCase()} gerada por IA em ${new Date().toISOString()}. Requer validação visual.`,
          })
          .eq("id", asset.id);

        if (updateErr) {
          results.push({ asset_id: asset.id, diagnosis: asset.diagnosis, status: "failed", error: updateErr.message });
        } else {
          results.push({ asset_id: asset.id, diagnosis: asset.diagnosis, status: "success", image_url: publicUrl });
        }

        await new Promise((r) => setTimeout(r, 1000));
      } catch (assetErr) {
        results.push({
          asset_id: asset.id,
          diagnosis: asset.diagnosis,
          status: "failed",
          error: String(assetErr),
        });
      }
    }

    const summary = {
      image_type,
      total_processed: results.length,
      success: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
