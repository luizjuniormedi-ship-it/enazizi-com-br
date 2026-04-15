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
    // assets: Array<{ filename, base64, image_type, diagnosis, difficulty, source, metadata }>

    if (!assets || !Array.isArray(assets)) {
      return new Response(JSON.stringify({ error: "assets array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const asset of assets) {
      try {
        // Decode base64
        const binaryStr = atob(asset.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const storagePath = `${asset.image_type}/${asset.filename}`;

        // Upload to storage
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

        // Insert into medical_image_assets
        const { error: insertError } = await supabase
          .from("medical_image_assets")
          .insert({
            image_type: asset.image_type,
            diagnosis: asset.diagnosis,
            difficulty: asset.difficulty,
            source: asset.source,
            image_url: urlData.publicUrl,
            is_active: true,
            question_generated: false,
            review_status: "approved",
            clinical_confidence: 0.95,
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
      JSON.stringify({ ok, failed, total: assets.length, details: results.filter((r) => !r.ok) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
