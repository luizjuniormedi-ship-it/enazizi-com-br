import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { limit = 5, offset = 0 } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get ISIC uploads that haven't been processed yet
    const { data: uploads, error: fetchErr } = await supabase
      .from("uploads")
      .select("id, filename, storage_path, category")
      .like("filename", "ISIC_%")
      .order("filename", { ascending: true })
      .range(offset, offset + limit - 1);

    if (fetchErr) throw new Error(`Fetch uploads: ${fetchErr.message}`);
    if (!uploads?.length) {
      return new Response(JSON.stringify({ message: "No ISIC uploads found", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${uploads.length} ISIC images...`);
    const results: any[] = [];

    for (const upload of uploads) {
      console.log(`\n--- ${upload.filename} ---`);

      // Download image with service role (bypasses RLS)
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("user-uploads")
        .download(upload.storage_path);

      if (dlErr || !fileData) {
        console.error(`Download failed for ${upload.filename}:`, dlErr?.message);
        results.push({ filename: upload.filename, error: dlErr?.message || "Download failed" });
        continue;
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);
      const imageDataUrl = `data:image/jpeg;base64,${b64}`;
      console.log(`  Downloaded ${bytes.length} bytes`);

      // Call AI with vision
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um dermatologista certificado analisando imagens do dataset ISIC (International Skin Imaging Collaboration). Analise a imagem com precisão clínica. Retorne APENAS JSON válido, sem markdown.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analise esta imagem dermatológica (ISIC dataset, arquivo: ${upload.filename}).
Retorne APENAS JSON válido:
{
  "diagnosis": "diagnóstico mais provável em português",
  "diagnosis_en": "diagnosis in English",
  "image_type": "dermatoscopia" ou "foto_clinica",
  "difficulty": "easy", "medium" ou "hard",
  "description": "descrição clínica em português, 2-3 frases",
  "differential_diagnoses": ["diag1", "diag2", "diag3"],
  "clinical_history": "história clínica realista em português, 3-4 frases com idade, gênero, queixa, duração",
  "physical_exam": "achados do exame físico em português",
  "treatment": "tratamento em português, 2-3 frases",
  "specialty": "Dermatologia",
  "confidence": 0.0 a 1.0
}`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageDataUrl },
                },
              ],
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`  AI error (${aiResponse.status}):`, errText.slice(0, 200));
        results.push({ filename: upload.filename, error: `AI ${aiResponse.status}` });
        continue;
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.trim();
      if (content.startsWith("```")) {
        content = content.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim();
      }

      let analysis: any;
      try {
        analysis = JSON.parse(content);
      } catch {
        console.error(`  JSON parse failed:`, content.slice(0, 200));
        results.push({ filename: upload.filename, error: "JSON parse failed", raw: content.slice(0, 300) });
        continue;
      }

      console.log(`  → ${analysis.diagnosis} (conf: ${analysis.confidence})`);

      // Insert into medical_image_assets
      const { data: asset, error: assetErr } = await supabase.from("medical_image_assets").insert({
        image_url: `${supabaseUrl}/storage/v1/object/authenticated/user-uploads/${upload.storage_path}`,
        image_type: analysis.image_type === "dermatoscopia" ? "dermoscopy" : "clinical_photo",
        diagnosis: analysis.diagnosis,
        diagnosis_en: analysis.diagnosis_en,
        description: analysis.description,
        difficulty: analysis.difficulty,
        specialty: analysis.specialty || "Dermatologia",
        source: "isic-dataset",
        source_url: `https://www.isic-archive.com`,
        clinical_confidence: analysis.confidence || 0.7,
        review_status: "needs_review",
        is_active: true,
        question_generated: false,
        metadata: {
          original_filename: upload.filename,
          upload_id: upload.id,
          differential_diagnoses: analysis.differential_diagnoses,
          ai_model: "gemini-2.5-flash",
        },
      }).select("id").single();

      if (assetErr) {
        console.error(`  Asset insert error:`, assetErr.message);
      }

      // Insert into clinical_cases
      const { error: caseErr } = await supabase.from("clinical_cases").insert({
        user_id: "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023", // admin user
        title: `Caso Clínico - ${analysis.diagnosis}`,
        clinical_history: analysis.clinical_history,
        physical_exam: analysis.physical_exam,
        correct_diagnosis: analysis.diagnosis,
        differential_diagnoses: analysis.differential_diagnoses,
        treatment: analysis.treatment,
        specialty: analysis.specialty || "Dermatologia",
        difficulty: analysis.difficulty === "easy" ? 1 : analysis.difficulty === "medium" ? 3 : 5,
        imaging: upload.filename,
        source: "isic-ai-generated",
        is_global: true,
        explanation: analysis.description,
      });

      if (caseErr) {
        console.error(`  Case insert error:`, caseErr.message);
      }

      results.push({
        filename: upload.filename,
        diagnosis: analysis.diagnosis,
        confidence: analysis.confidence,
        difficulty: analysis.difficulty,
        asset_id: asset?.id,
        success: true,
      });

      // Rate limit
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log(`\nDone. ${results.filter((r) => r.success).length}/${uploads.length} processed.`);

    return new Response(JSON.stringify({ results, total: uploads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
