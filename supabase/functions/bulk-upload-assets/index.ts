import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { assets } = await req.json();

    if (!assets || !Array.isArray(assets)) {
      return new Response(JSON.stringify({ error: "assets array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const asset of assets) {
      try {
        const binaryStr = atob(asset.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const storagePath = `${asset.image_type}/${asset.filename}`;

        const { error: uploadError } = await supabase.storage
          .from("question-images")
          .upload(storagePath, bytes, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) {
          results.push({ filename: asset.filename, ok: false, error: uploadError.message });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("question-images")
          .getPublicUrl(storagePath);

        const { error: insertError } = await supabase
          .from("medical_image_assets")
          .insert({
            image_type: asset.image_type,
            diagnosis: asset.diagnosis,
            difficulty: asset.difficulty || "medium",
            image_url: urlData.publicUrl,
            is_active: true,
            question_generated: false,
            review_status: "approved",
            clinical_confidence: 0.95,
            specialty: asset.specialty || "Pneumologia",
            subtopic: asset.subtopic || asset.diagnosis,
            asset_code: `${asset.image_type}_${asset.filename.replace(/\.[^.]+$/, "")}`,
            asset_origin: asset.asset_origin || "kaggle_chest_xray_pneumonia",
            license_type: asset.license_type || "CC BY 4.0",
            incidence_weight: 1.0,
            clinical_findings: asset.clinical_findings || {},
            distractors: asset.distractors || [],
            tri_a: 1.0,
            tri_b: 0.0,
            tri_c: 0.25,
            version: 1,
          });

        if (insertError) {
          results.push({ filename: asset.filename, ok: false, error: insertError.message });
        } else {
          results.push({ filename: asset.filename, ok: true });
        }
      } catch (e) {
        results.push({ filename: asset.filename, ok: false, error: e.message });
      }
    }

    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return new Response(
      JSON.stringify({ ok, failed, total: assets.length, details: results.filter((r) => !r.ok).slice(0, 5) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
