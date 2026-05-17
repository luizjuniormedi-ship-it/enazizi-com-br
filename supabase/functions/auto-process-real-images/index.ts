import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
import { extractCleanImageUrls, validateImageVision } from "../_shared/vision-gate.ts";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCE_MAP: Record<string, { urls: string[]; license: string }> = {
  ecg: { urls: ["https://litfl.com/ecg-library/{query}/", "https://en.ecgpedia.org/wiki/{query}"], license: "cc_by_nc_sa" },
  xray: { urls: ["https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}&scope=cases"], license: "cc_by_nc_sa" },
  ct: { urls: ["https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}&scope=cases"], license: "cc_by_nc_sa" },
  us: { urls: ["https://radiopaedia.org/search?utf8=%E2%9C%93&q={query}+ultrasound&scope=cases"], license: "cc_by_nc_sa" },
  dermatology: { urls: ["https://dermnetnz.org/topics/{query}"], license: "cc_by_nc_nd" },
  pathology: { urls: ["https://www.pathologyoutlines.com/search?searchterm={query}"], license: "educational_fair_use" },
  ophthalmology: { urls: ["https://eyewiki.aao.org/w/index.php?search={query}"], license: "cc_by_nc_nd" },
};

function buildSearchUrl(template: string, query: string): string {
  const slug = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return template.replace("{query}", encodeURIComponent(slug));
}

function extractImageUrls(html: string): string[] {
  return extractCleanImageUrls(html);
}

async function downloadAndUpload(imageUrl: string, imageType: string, assetCode: string): Promise<string | null> {
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return null;
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const buffer = new Uint8Array(await imgResp.arrayBuffer());
    if (buffer.length < 5000) return null;
    const ext = contentType.includes("png") ? "png" : "jpg";
    const safeCode = assetCode.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
    const filePath = `${imageType}/${safeCode}_real_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("question-images").upload(filePath, buffer, { contentType, upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data: urlData } = supabase.storage.from("question-images").getPublicUrl(filePath);
    return urlData.publicUrl;
  } catch (err) { console.error("Download/upload error:", err); return null; }
}

async function searchImageForAsset(asset: any): Promise<{ found: boolean; imageUrl?: string; sourceUrl?: string; sourceDomain?: string }> {
  const sources = SOURCE_MAP[asset.image_type] || SOURCE_MAP["xray"];
  
  // Try direct scrape
  for (const urlTemplate of sources.urls) {
    const searchUrl = buildSearchUrl(urlTemplate, asset.diagnosis);
    console.log(`[${asset.image_type}] Scraping: ${searchUrl}`);
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: searchUrl, formats: ["html"], onlyMainContent: true, waitFor: 3000 }),
      });
      if (response.ok) {
        const data = await response.json();
        const html = data?.data?.html || data?.html || "";
        const images = extractImageUrls(html);
        for (const imgUrl of images.slice(0, 5)) {
          const uploaded = await downloadAndUpload(imgUrl, asset.image_type, asset.asset_code || asset.diagnosis);
          if (uploaded) {
            const vision = await validateImageVision(uploaded, asset.diagnosis, asset.image_type, LOVABLE_API_KEY);
            if (!vision.valid) {
              console.warn(`[Vision REJECTED] ${imgUrl}: ${vision.reason}`);
              continue;
            }
            const domain = new URL(searchUrl).hostname;
            await supabase.from("medical_image_assets").update({
              image_url: uploaded, thumbnail_url: uploaded, asset_origin: "real_clinical",
              source_url: searchUrl, license_type: sources.license, source_domain: domain,
              review_status: "needs_review", integrity_status: "pending", clinical_confidence: 0.85,
              is_active: true,
              clinical_validation_notes: `Imagem real de ${domain} em ${new Date().toISOString()}.`,
            }).eq("id", asset.id);
            return { found: true, imageUrl: uploaded, sourceUrl: searchUrl, sourceDomain: domain };
          }
        }
      }
    } catch (err) { console.error(`Scrape error:`, err); }
  }

  // Fallback: Firecrawl search
  const modalityTerms: Record<string, string> = {
    ecg: "ECG electrocardiogram", xray: "X-ray radiograph", ct: "CT scan",
    us: "ultrasound", dermatology: "dermatology clinical photo",
    pathology: "histopathology", ophthalmology: "ophthalmology fundoscopy",
  };
  const searchQuery = `${asset.diagnosis} ${modalityTerms[asset.image_type] || asset.image_type} real clinical image`;
  console.log(`[${asset.image_type}] Search fallback: ${searchQuery}`);
  try {
    const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, limit: 3, scrapeOptions: { formats: ["html"] } }),
    });
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const results = searchData?.data || [];
      for (const result of results) {
        const html = result?.html || "";
        const images = extractImageUrls(html);
        for (const imgUrl of images.slice(0, 3)) {
          const uploaded = await downloadAndUpload(imgUrl, asset.image_type, asset.asset_code || asset.diagnosis);
          if (uploaded) {
            const vision = await validateImageVision(uploaded, asset.diagnosis, asset.image_type, LOVABLE_API_KEY);
            if (!vision.valid) {
              console.warn(`[Vision REJECTED] ${imgUrl}: ${vision.reason}`);
              continue;
            }
            const domain = result?.url ? new URL(result.url).hostname : "web_search";
            await supabase.from("medical_image_assets").update({
              image_url: uploaded, thumbnail_url: uploaded, asset_origin: "real_clinical",
              source_url: result?.url || "", license_type: "cc_by_nc_sa", source_domain: domain,
              review_status: "needs_review", integrity_status: "pending", clinical_confidence: 0.85,
              is_active: true,
              clinical_validation_notes: `Imagem real encontrada via search em ${domain}.`,
            }).eq("id", asset.id);
            return { found: true, imageUrl: uploaded, sourceUrl: result?.url, sourceDomain: domain };
          }
        }
      }
    }
  } catch (err) { console.error("Search fallback error:", err); }

  return { found: false };
}

async function generateQuestionsForAsset(asset: any): Promise<number> {
  if (!LOVABLE_API_KEY) { console.error("No LOVABLE_API_KEY"); return 0; }

  const prompt = `Você é um professor de medicina especialista. Gere EXATAMENTE 3 questões de residência médica sobre esta imagem clínica.

CONTEXTO DO ASSET:
- Tipo: ${asset.image_type}
- Diagnóstico: ${asset.diagnosis}
- Achados: ${JSON.stringify(asset.clinical_findings || {})}

REGRAS OBRIGATÓRIAS:
1. Enunciado MÍNIMO 400 caracteres, contexto clínico realista
2. EXATAMENTE 5 alternativas (A-E), cada uma com 80+ caracteres
3. Explicação MÍNIMA 200 caracteres
4. Dificuldade variada: 1 fácil, 1 média, 1 difícil
5. SEM caracteres especiais quebrados (**, ##, \\n literal)
6. Português brasileiro correto
7. Estilo de prova USP/UNIFESP/ENARE

Retorne APENAS JSON válido:
[
  {
    "statement": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
    "correct_index": 0,
    "explanation": "...",
    "difficulty": 3,
    "exam_style": "USP",
    "topic": "...",
    "subtopic": "..."
  }
]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    });

    if (!response.ok) { console.error("AI error:", await response.text()); return 0; }

    const aiData = await response.json();
    const content = aiData?.choices?.[0]?.message?.content || "";
    
    // Extract JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { console.error("No JSON found in AI response"); return 0; }

    let questions;
    try { questions = JSON.parse(jsonMatch[0]); } catch { console.error("JSON parse error"); return 0; }

    let inserted = 0;
    for (const q of questions) {
      if (!q.statement || q.statement.length < 200 || !q.options || q.options.length < 5) continue;

      // Clean text
      const cleanText = (t: string) => t
        .replace(/\*\*/g, "").replace(/##/g, "").replace(/\\n/g, " ")
        .replace(/\s{2,}/g, " ").trim();

      const { error } = await supabase.from("medical_image_questions").insert({
        asset_id: asset.id,
        statement: cleanText(q.statement),
        options: q.options.map((o: string) => cleanText(o)),
        correct_index: q.correct_index || 0,
        explanation: cleanText(q.explanation || ""),
        difficulty: q.difficulty || 3,
        exam_style: q.exam_style || "USP",
        topic: q.topic || asset.diagnosis,
        subtopic: q.subtopic || asset.image_type,
        status: "needs_review",
        question_origin: "ai_generated_v3",
      });

      if (!error) inserted++;
      else console.error("Insert error:", error);
    }
    return inserted;
  } catch (err) { console.error("Generate questions error:", err); return 0; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const imageType = body.image_type || "ecg";
    const batchSize = body.batch_size || 3;
    const offset = body.offset || 0;
    const generateQuestions = body.generate_questions !== false;

    // Get batch of pending assets
    const { data: assets, error } = await supabase
      .from("medical_image_assets")
      .select("id, asset_code, diagnosis, image_type, clinical_findings, image_url, asset_origin")
      .eq("image_type", imageType)
      .or("asset_origin.eq.pending_real,asset_origin.eq.ai_generated,asset_origin.eq.ai_generated_v2,image_url.is.null")
      .order("diagnosis")
      .range(offset, offset + batchSize - 1);

    if (error || !assets) {
      return new Response(JSON.stringify({ error: error?.message || "No assets" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${assets.length} ${imageType} assets (offset ${offset})`);

    const summary: Record<string, { searched: number; found: number; questions: number }> = {};
    let totalFound = 0;
    let totalQuestions = 0;

    for (const asset of assets) {
      if (!summary[asset.image_type]) summary[asset.image_type] = { searched: 0, found: 0, questions: 0 };
      summary[asset.image_type].searched++;

      // Search for real image
      const result = await searchImageForAsset(asset);
      
      if (result.found) {
        summary[asset.image_type].found++;
        totalFound++;
        console.log(`✓ Found: ${asset.diagnosis} (${asset.image_type}) from ${result.sourceDomain}`);

        // Generate questions for this asset
        if (generateQuestions) {
          const refreshed = { ...asset, image_url: result.imageUrl };
          const count = await generateQuestionsForAsset(refreshed);
          summary[asset.image_type].questions += count;
          totalQuestions += count;
          console.log(`  → Generated ${count} questions`);
        }
      } else {
        console.log(`✗ Not found: ${asset.diagnosis} (${asset.image_type})`);
      }

      // Rate limiting: wait between assets
      await new Promise(r => setTimeout(r, 2000));
    }

    const has_more = assets.length === batchSize;
    return new Response(JSON.stringify({
      status: "completed",
      image_type: imageType,
      total_assets: assets.length,
      images_found: totalFound,
      questions_generated: totalQuestions,
      has_more,
      next_offset: offset + assets.length,
      summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
