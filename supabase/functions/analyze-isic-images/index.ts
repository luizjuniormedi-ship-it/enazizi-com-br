import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detectImageCategory(filename: string): { category: string; specialty: string; promptSystem: string; promptUser: (fn: string) => string } {
  const lower = filename.toLowerCase();

  if (lower.startsWith("isic_")) {
    return {
      category: "dermatology",
      specialty: "Dermatologia",
      promptSystem: `Você é um dermatologista certificado analisando imagens do dataset ISIC. Analise com precisão clínica. Retorne APENAS JSON válido, sem markdown.`,
      promptUser: (fn) => `Analise esta imagem dermatológica (ISIC dataset, arquivo: ${fn}).
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
    };
  }

  if (lower.startsWith("effusion")) {
    return {
      category: "radiology_effusion",
      specialty: "Pneumologia",
      promptSystem: `Você é um radiologista e pneumologista certificado analisando radiografias de tórax com derrame pleural. Analise com precisão clínica. Retorne APENAS JSON válido, sem markdown.`,
      promptUser: (fn) => `Analise esta radiografia de tórax (arquivo: ${fn}). A imagem é de um caso de derrame pleural.
Retorne APENAS JSON válido:
{
  "diagnosis": "diagnóstico mais provável em português",
  "diagnosis_en": "diagnosis in English",
  "image_type": "radiografia_torax",
  "difficulty": "easy", "medium" ou "hard",
  "description": "descrição radiológica em português, 2-3 frases (achados, padrão, lateralidade)",
  "differential_diagnoses": ["diag1", "diag2", "diag3"],
  "clinical_history": "história clínica realista em português, 3-4 frases com idade, gênero, dispneia, tosse, febre",
  "physical_exam": "achados do exame físico em português (murmúrio vesicular, macicez, etc)",
  "treatment": "tratamento em português, 2-3 frases (toracocentese, antibiótico se indicado, etc)",
  "specialty": "Pneumologia",
  "confidence": 0.0 a 1.0
}`,
    };
  }

  if (lower.startsWith("person") && lower.includes("bacteria")) {
    return {
      category: "radiology_pneumonia",
      specialty: "Pneumologia",
      promptSystem: `Você é um radiologista e pneumologista certificado analisando radiografias de tórax com pneumonia bacteriana. Analise com precisão clínica. Retorne APENAS JSON válido, sem markdown.`,
      promptUser: (fn) => `Analise esta radiografia de tórax (arquivo: ${fn}). A imagem é de um caso de pneumonia bacteriana.
Retorne APENAS JSON válido:
{
  "diagnosis": "diagnóstico mais provável em português",
  "diagnosis_en": "diagnosis in English",
  "image_type": "radiografia_torax",
  "difficulty": "easy", "medium" ou "hard",
  "description": "descrição radiológica em português, 2-3 frases (consolidação, broncograma aéreo, padrão)",
  "differential_diagnoses": ["diag1", "diag2", "diag3"],
  "clinical_history": "história clínica realista em português, 3-4 frases com idade, gênero, febre, tosse produtiva, dispneia",
  "physical_exam": "achados do exame físico em português (estertores, sopro tubário, etc)",
  "treatment": "tratamento em português, 2-3 frases (antibioticoterapia empírica, suporte)",
  "specialty": "Pneumologia",
  "confidence": 0.0 a 1.0
}`,
    };
  }

  // Generic medical image
  return {
    category: "medical_general",
    specialty: "Clínica Médica",
    promptSystem: `Você é um médico especialista analisando uma imagem médica/clínica. Analise com precisão. Retorne APENAS JSON válido, sem markdown.`,
    promptUser: (fn) => `Analise esta imagem médica (arquivo: ${fn}).
Retorne APENAS JSON válido:
{
  "diagnosis": "diagnóstico mais provável em português",
  "diagnosis_en": "diagnosis in English",
  "image_type": "tipo da imagem (radiografia, dermoscopia, ecg, tc, etc)",
  "difficulty": "easy", "medium" ou "hard",
  "description": "descrição clínica em português, 2-3 frases",
  "differential_diagnoses": ["diag1", "diag2", "diag3"],
  "clinical_history": "história clínica realista em português, 3-4 frases",
  "physical_exam": "achados do exame físico em português",
  "treatment": "tratamento em português, 2-3 frases",
  "specialty": "especialidade médica",
  "confidence": 0.0 a 1.0
}`,
  };
}

function mapImageType(raw: string): string {
  const map: Record<string, string> = {
    dermatoscopia: "dermoscopy",
    foto_clinica: "clinical_photo",
    radiografia_torax: "xray",
    radiografia: "xray",
    tc: "ct",
    ecg: "ecg",
    ultrassom: "us",
  };
  return map[raw?.toLowerCase()] || raw || "clinical_photo";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { limit = 10, offset = 0, filter } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build query for image files
    let query = supabase
      .from("uploads")
      .select("id, filename, storage_path, category")
      .order("filename", { ascending: true })
      .range(offset, offset + limit - 1);

    // Filter by type if specified
    if (filter === "isic") {
      query = query.like("filename", "ISIC_%");
    } else if (filter === "effusion") {
      query = query.like("filename", "effusion%");
    } else if (filter === "pneumonia") {
      query = query.like("filename", "person%");
    }
    // else: all image files

    const { data: uploads, error: fetchErr } = await query;
    if (fetchErr) throw new Error(`Fetch uploads: ${fetchErr.message}`);

    // Filter to image files only
    const imageUploads = (uploads || []).filter((u: any) => {
      const fn = u.filename.toLowerCase();
      return fn.endsWith(".jpg") || fn.endsWith(".jpeg") || fn.endsWith(".png") || fn.endsWith(".webp");
    });

    if (!imageUploads.length) {
      return new Response(JSON.stringify({ message: "No image uploads found in range", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${imageUploads.length} images (offset=${offset})...`);
    const results: any[] = [];

    for (const upload of imageUploads) {
      const meta = detectImageCategory(upload.filename);
      console.log(`\n--- ${upload.filename} [${meta.category}] ---`);

      // Download image
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("user-uploads")
        .download(upload.storage_path);

      if (dlErr || !fileData) {
        console.error(`Download failed for ${upload.filename}:`, dlErr?.message);
        results.push({ filename: upload.filename, error: dlErr?.message || "Download failed" });
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const ext = upload.filename.split(".").pop()?.toLowerCase() || "jpeg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      const imageDataUrl = `data:${mime};base64,${b64}`;

      // Call AI
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini-mini",
          messages: [
            { role: "system", content: meta.promptSystem },
            {
              role: "user",
              content: [
                { type: "text", text: meta.promptUser(upload.filename) },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI error (${aiResponse.status}):`, errText.slice(0, 200));
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
        console.error(`JSON parse failed:`, content.slice(0, 200));
        results.push({ filename: upload.filename, error: "JSON parse failed", raw: content.slice(0, 300) });
        continue;
      }

      console.log(`→ ${analysis.diagnosis} (conf: ${analysis.confidence})`);

      // Insert into medical_image_assets
      const { data: asset, error: assetErr } = await supabase.from("medical_image_assets").insert({
        image_url: `${supabaseUrl}/storage/v1/object/authenticated/user-uploads/${upload.storage_path}`,
        image_type: mapImageType(analysis.image_type),
        diagnosis: analysis.diagnosis,
        clinical_findings: analysis.description,
        difficulty: analysis.difficulty,
        specialty: analysis.specialty || meta.specialty,
        source_reference: `${meta.category}-dataset`,
        source_url: meta.category === "dermatology" ? "https://www.isic-archive.com" : "https://www.kaggle.com",
        clinical_confidence: analysis.confidence || 0.7,
        asset_origin: "ai_curated",
        review_status: "needs_review",
        is_active: true,
        question_generated: false,
        distractors: analysis.differential_diagnoses,
        curation_notes: `AI-analyzed: ${upload.filename} | ${meta.category} | conf: ${analysis.confidence}`,
      }).select("id").single();

      if (assetErr) console.error(`Asset insert error:`, assetErr.message);

      // Insert into clinical_cases
      const { error: caseErr } = await supabase.from("clinical_cases").insert({
        user_id: "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023",
        title: `Caso Clínico - ${analysis.diagnosis}`,
        clinical_history: analysis.clinical_history,
        physical_exam: analysis.physical_exam,
        correct_diagnosis: analysis.diagnosis,
        differential_diagnoses: analysis.differential_diagnoses,
        treatment: analysis.treatment,
        specialty: analysis.specialty || meta.specialty,
        difficulty: analysis.difficulty === "easy" ? 1 : analysis.difficulty === "medium" ? 3 : 5,
        imaging: upload.filename,
        source: `${meta.category}-ai-generated`,
        is_global: true,
        explanation: analysis.description,
      });

      if (caseErr) console.error(`Case insert error:`, caseErr.message);

      results.push({
        filename: upload.filename,
        category: meta.category,
        diagnosis: analysis.diagnosis,
        confidence: analysis.confidence,
        difficulty: analysis.difficulty,
        asset_id: asset?.id,
        success: true,
      });

      // Rate limit
      await new Promise((r) => setTimeout(r, 1500));
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\nDone. ${successCount}/${imageUploads.length} processed.`);

    return new Response(JSON.stringify({ results, total: imageUploads.length, success: successCount }), {
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
