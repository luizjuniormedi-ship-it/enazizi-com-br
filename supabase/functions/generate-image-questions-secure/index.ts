import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Generate questions for a single asset ──
async function generateForAsset(asset: {
  id: string; asset_code: string; diagnosis: string; image_type: string;
  specialty: string; subtopic: string; difficulty: string; image_url: string;
}): Promise<{ status: string; error?: string }> {
  const prompt = `Você é um professor de medicina especialista em provas de residência (USP, UNIFESP, ENARE).

Gere EXATAMENTE 3 questões de múltipla escolha sobre esta imagem médica.

DADOS DO ASSET:
- Tipo: ${asset.image_type}
- Diagnóstico: ${asset.diagnosis}
- Especialidade: ${asset.specialty}
- Subtema: ${asset.subtopic}

REGRAS OBRIGATÓRIAS:
1. Enunciado: caso clínico realista com ≥400 caracteres, incluindo idade, sexo, queixa, história, exame físico
2. EXATAMENTE 5 alternativas (A-E), cada uma com ≥80 caracteres
3. Explicação detalhada com ≥300 caracteres
4. Discussão médica: fisiopatologia, diagnóstico diferencial
5. Dicas de prova (exam_tips): o que as bancas cobram
6. Armadilhas (pitfalls): erros comuns dos candidatos
7. Distribuir dificuldade: 1 fácil, 1 média, 1 difícil
8. Português brasileiro, estilo prova real
9. SEM markdown (**, ##, *)

Retorne APENAS JSON válido:
[{
  "statement": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "correct_index": 0,
  "explanation": "...",
  "discussion": "...",
  "exam_tips": "...",
  "pitfalls": "...",
  "difficulty": "easy|medium|hard",
  "exam_style": "USP"
}]`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: asset.image_url } },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { status: "ai_error", error: `AI ${resp.status}: ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { status: "parse_error", error: "No JSON array in AI response" };

    const questions = JSON.parse(jsonMatch[0]);
    const clean = (t: string) =>
      t.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").replace(/\\n/g, " ").replace(/\s{2,}/g, " ").trim();

    let inserted = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.statement || q.statement.length < 150 || !q.options || q.options.length < 5) continue;

      const questionCode = `secure_${asset.asset_code}_q${i}_${Date.now()}`;
      const validDiffs = ["easy", "medium", "hard"];
      const diff = validDiffs.includes(q.difficulty) ? q.difficulty : asset.difficulty;

      const { error } = await sb.from("medical_image_questions").insert({
        asset_id: asset.id,
        question_code: questionCode,
        statement: clean(q.statement),
        option_a: clean(q.options[0] || ""),
        option_b: clean(q.options[1] || ""),
        option_c: clean(q.options[2] || ""),
        option_d: clean(q.options[3] || ""),
        option_e: clean(q.options[4] || ""),
        correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
        explanation: clean(q.explanation || ""),
        discussion: q.discussion ? { text: clean(q.discussion) } : null,
        exam_tips: Array.isArray(q.exam_tips) ? q.exam_tips.map(clean) : q.exam_tips ? [clean(q.exam_tips)] : [],
        pitfalls: Array.isArray(q.pitfalls) ? q.pitfalls.map(clean) : q.pitfalls ? [clean(q.pitfalls)] : [],
        difficulty: diff,
        exam_style: q.exam_style || "USP",
        status: "published",
        language_code: "pt-BR",
        senior_audit_score: 70,
        editorial_grade: "good",
      });

      if (!error) inserted++;
      else console.error(`[q-insert] ${error.message}`);
    }

    if (inserted > 0) {
      await sb.from("medical_image_assets").update({ question_generated: true }).eq("id", asset.id);
    }

    return { status: inserted > 0 ? "generated" : "no_valid_questions", error: inserted === 0 ? "All questions failed validation" : undefined };
  } catch (e) {
    return { status: "exception", error: (e as Error).message };
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { asset_ids, force = false, batch_size = 10 } = body;

    // Mode 1: specific asset_ids
    // Mode 2: auto-select unprocessed assets
    let assets;
    if (asset_ids && Array.isArray(asset_ids) && asset_ids.length > 0) {
      let query = sb.from("medical_image_assets").select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url").in("id", asset_ids);
      if (!force) query = query.eq("question_generated", false);
      const { data, error } = await query;
      if (error) throw error;
      assets = data || [];
    } else {
      // Auto-select: ONLY quality-gate-passed assets without questions
      const { data, error } = await sb
        .from("medical_image_assets")
        .select("id, asset_code, diagnosis, image_type, specialty, subtopic, difficulty, image_url, quality_gate_passed")
        .eq("question_generated", false)
        .eq("is_active", true)
        .eq("quality_gate_passed", true)
        .eq("integrity_status", "ok")
        .in("review_status", ["published", "needs_review"])
        .in("image_type", ["xray", "ecg", "ct", "us", "dermatology", "pathology", "ophthalmology"])
        .not("image_url", "is", null)
        .neq("image_url", "")
        .limit(Math.min(batch_size, 20));
      if (error) throw error;
      // Additional URL validation: reject non-medical URLs
      const blocked = ["logo", "stock", "laptop", "placeholder", "generic", "algoscope", "notebook", "banner",
        "mockup", "screenshot", "dashboard", "portrait", "avatar", "icon", "favicon", "thumbnail"];
      assets = (data || []).filter((a: any) => {
        const url = (a.image_url || "").toLowerCase();
        if (blocked.some(b => url.includes(b))) {
          console.log("ASSET BLOCKED (bad URL):", a.asset_code, a.image_url);
          return false;
        }
        if (!a.diagnosis || a.diagnosis.trim().length < 3) {
          console.log("ASSET BLOCKED (no diagnosis):", a.asset_code);
          return false;
        }
        return true;
      });
    }

    if (assets.length === 0) {
      return new Response(JSON.stringify({ processed: 0, generated: 0, skipped: 0, failed: 0, message: "No assets to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { processed: 0, generated: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (const asset of assets) {
      results.processed++;
      console.log(`[gen-q] Processing ${asset.asset_code} (${asset.image_type}/${asset.diagnosis})`);

      const result = await generateForAsset(asset);

      if (result.status === "generated") {
        results.generated++;
      } else {
        results.failed++;
        results.errors.push(`${asset.asset_code}: ${result.error}`);
        console.error(`[gen-q] Failed ${asset.asset_code}: ${result.error}`);
      }

      // Rate limit between items
      if (assets.length > 1) await new Promise(r => setTimeout(r, 2000));
    }

    // Log execution
    await sb.from("pipeline_logs").insert({
      dataset_type: "mixed",
      mode: "questions_only",
      batch_size: assets.length,
      items_processed: results.processed,
      questions_generated: results.generated,
      errors: results.failed,
      error_details: results.errors.length > 0 ? results.errors : null,
    }).then(() => {});

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fatal]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
