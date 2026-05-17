// bulk-generate-content - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: High-volume content generation with industrial-grade resilience.

import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

const SPECIALTIES = [
  "Cardiologia", "Pneumologia", "Neurologia", "Endocrinologia",
  "Gastroenterologia", "Pediatria", "Ginecologia e Obstetrícia",
  "Cirurgia", "Medicina Preventiva", "Nefrologia",
  "Infectologia", "Hematologia", "Reumatologia", "Dermatologia",
  "Ortopedia", "Urologia", "Psiquiatria", "Oftalmologia",
  "Otorrinolaringologia", "Medicina de Emergência", "Semiologia", "Anatomia", "Farmacologia",
  "Oncologia", "Fisiologia", "Bioquímica", "Angiologia",
  "Histologia", "Embriologia", "Microbiologia", "Imunologia",
  "Parasitologia", "Genética Médica", "Patologia",
  "Terapia Intensiva",
];

Deno.serve(enterpriseEdgeHandler("bulk-generate-content", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  // 1. AUTH & ADMIN CHECK
  const { user } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  // 2. HANDLE POLLING (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");
    if (jobId) {
      const { data, error } = await supabaseAdmin
        .from("pipeline_governance")
        .select("*")
        .eq("id", jobId)
        .single();
      
      if (error) throw new Error(`Job not found: ${error.message}`);
      
      return new Response(JSON.stringify({
        status: data.status,
        result: data.metadata?.result,
        error: data.failure_reason,
        progress: data.metadata?.progress
      }), { headers: { "Content-Type": "application/json" } });
    }
  }

  // 3. PARSE REQUEST (POST)
  const body = await req.json().catch(() => ({}));
  const specialty = body.specialty || SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const count = Math.min(body.count || 5, 15);
  const equalize = body.equalize === true;

  logger.info("START_GENERATION", `Request for ${specialty} (equalize: ${equalize})`, { specialty, count, equalize });

  // Create initial governance record as a "job"
  const { data: job, error: jobError } = await supabaseAdmin.from("pipeline_governance").insert({
    pipeline_name: "bulk-generate",
    function_name: "bulk-generate-content",
    status: "processing",
    user_id: user.id,
    metadata: {
      specialty,
      target_count: count,
      correlation_id: correlation.correlationId,
      equalize
    }
  }).select().single();

  if (jobError) throw jobError;

  const processGeneration = async () => {
    try {
      let contextInfo = "";
      if (equalize) {
        logger.info("EQUALIZATION", `Starting equalization for ${specialty}`);
        try {
          const searchResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-real-questions?specialty=${encodeURIComponent(specialty)}`, {
            headers: { Authorization: req.headers.get("Authorization") || "" }
          });
          
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const foundCount = searchData?.log?.questions_found || 0;
            if (foundCount > 0 && searchData.questions) {
              contextInfo = `\nUSE ESTAS QUESTÕES REAIS COMO REFERÊNCIA DE ESTILO E PADRÃO:\n${JSON.stringify(searchData.questions.slice(0, 3))}`;
            }
          }
        } catch (searchErr) {
          logger.warn("SEARCH_FAILED", "Real questions search failed", { error: searchErr.message });
        }
      }

      const prompt = `Gere ${count} questões de MCQ para residência médica sobre ${specialty}.${contextInfo}
REGRAS:
- Padrão Ouro (ENARE/USP/Revalida).
- Casos clínicos realistas e densos em português brasileiro.
- 5 alternativas, 1 correta.
- Retorne APENAS JSON: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "...", "topic": "${specialty}", "difficulty": 3}]}`;

      const aiResponse = await callAi({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Professor de medicina especialista em provas de residência. Responda APENAS JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
        taskType: "reasoning"
      }, logger, supabaseAdmin);

      const aiContent = aiResponse.choices?.[0]?.message?.content || "";
      const parsed = parseAiJson(aiContent);
      const questions = parsed.questions || [];

      let savedCount = 0;
      for (const q of questions) {
        try {
          const { error: insertError } = await supabaseAdmin.from("questions_bank").insert({
            statement: sanitizeAiContent(q.statement),
            options: q.options,
            correct_index: q.correct_index,
            explanation: sanitizeAiContent(q.explanation),
            topic: q.topic || specialty,
            difficulty: q.difficulty || 3,
            is_global: true,
            quality_tier: "exam_standard",
            source: "bulk-ai-generator",
            review_status: "approved",
            board: "ENARE",
            year: 2025,
            user_id: user.id
          });
          if (!insertError) savedCount++;
        } catch (e) {
          logger.error("DB_INSERT_FAILED", "Failed to save question", { error: e.message });
        }
      }

      // Update Job status
      await supabaseAdmin.from("pipeline_governance").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...job.metadata,
          result: { total_generated: savedCount },
          questions_saved: savedCount
        }
      }).eq("id", job.id);

    } catch (err: any) {
      logger.error("GENERATION_PROCESS_FAILED", err.message, { stack: err.stack });
      await supabaseAdmin.from("pipeline_governance").update({
        status: "failed",
        failure_reason: err.message,
        error_stack: err.stack
      }).eq("id", job.id);
    }
  };

  waitUntil(processGeneration());

  return new Response(JSON.stringify({ 
    status: "processing", 
    job_id: job.id,
    specialty, 
    correlation_id: correlation.correlationId 
  }), {
    headers: { "Content-Type": "application/json" },
  });
}));
