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

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const specialty = body.specialty || SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const count = Math.min(body.count || 5, 15);
  const equalize = body.equalize === true;

  logger.info("START_GENERATION", `Request for ${specialty} (equalize: ${equalize})`, { specialty, count, equalize });

  const processGeneration = async () => {
    try {
      if (equalize) {
        logger.info("EQUALIZATION", `Starting equalization for ${specialty}`);
        try {
          // Attempt to find real questions first
          const searchResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-real-questions?specialty=${encodeURIComponent(specialty)}`, {
            headers: { Authorization: req.headers.get("Authorization") || "" }
          });
          
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            logger.info("SEARCH_RESULT", `Search found ${searchData?.log?.questions_found || 0} candidates`);
          }
        } catch (searchErr) {
          logger.warn("SEARCH_FAILED", "Real questions search failed, falling back to pure AI generation", { error: searchErr.message });
        }
      }

      const prompt = `Gere ${count} questões de MCQ para residência médica sobre ${specialty}.
REGRAS:
- Casos clínicos realistas e densos.
- 5 alternativas, 1 correta.
- Retorne APENAS JSON: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "...", "topic": "${specialty}", "difficulty": 3}]}`;

      const aiResponse = await callAi({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Professor de medicina especialista. Responda APENAS JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
        taskType: "reasoning"
      }, logger, supabaseAdmin);

      const aiContent = aiResponse.choices?.[0]?.message?.content || "";
      const parsed = parseAiJson(aiContent);
      const questions = parsed.questions || [];

      logger.info("AI_RESPONSE_PARSED", `Received ${questions.length} questions from AI`);

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
            year: 2025
          });

          if (!insertError) savedCount++;
          else logger.error("INSERT_ERROR", insertError.message, { question: q.statement.slice(0, 50) });
        } catch (e) {
          logger.error("DB_INSERT_FAILED", "Failed to save question", { error: e.message });
        }
      }

      logger.info("GENERATION_COMPLETED", `Successfully saved ${savedCount} questions`);

      // Governance
      await supabaseAdmin.from("pipeline_governance").insert({
        pipeline_name: "bulk-generate",
        function_name: "bulk-generate-content",
        status: savedCount > 0 ? "completed" : "failed",
        model_used: ALLOWED_MODELS.generation,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          specialty,
          count: savedCount,
          correlation_id: correlation.correlationId,
          equalize
        }
      });

      return { total_imported: 0, total_generated: savedCount };

    } catch (err: any) {
      logger.error("GENERATION_PROCESS_FAILED", err.message, { stack: err.stack });
      throw err;
    }
  };

  // 3. EXECUTE
  if (body.background !== false) {
    waitUntil(processGeneration());
    return new Response(JSON.stringify({ 
      status: "processing", 
      specialty, 
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    const result = await processGeneration();
    return new Response(JSON.stringify({ 
      status: "completed", 
      specialty,
      result,
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}));
