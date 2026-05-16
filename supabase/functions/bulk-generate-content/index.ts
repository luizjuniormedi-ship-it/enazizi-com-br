// bulk-generate-content - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: High-volume content generation with industrial-grade resilience.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
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

Deno.serve(enterpriseEdgeHandler("bulk-generate-content", async ({ req, logger, waitUntil, correlation, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH & ADMIN CHECK
  const { user, supabaseAdmin } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const specialty = body.specialty || SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
  const count = Math.min(body.count || 5, 15);

  logger.info("START_GENERATION", `Generating ${count} questions for ${specialty}`, { specialty, count });

  const processGeneration = async () => {
    try {
      const prompt = `Gere ${count} questões de MCQ para residência médica sobre ${specialty}.
REGRAS:
- Casos clínicos realistas.
- 5 alternativas, 1 correta.
- Retorne APENAS JSON: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "...", "topic": "${specialty}", "difficulty": 3}]}`;

      const aiResponse = await callAi({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Professor de medicina especialista. Responda APENAS JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
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
            review_status: "approved"
          });

          if (!insertError) savedCount++;
        } catch (e) {
          logger.error("DB_INSERT_FAILED", "Failed to save question", { error: e.message });
        }
      }

      logger.info("GENERATION_COMPLETED", `Successfully saved ${savedCount} questions`);

      // Governance
      await supabaseAdmin.from("pipeline_governance").insert({
        pipeline_name: "bulk-generate",
        function_name: "bulk-generate-content",
        status: savedCount === questions.length ? "completed" : "partial",
        model_used: ALLOWED_MODELS.generation,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          specialty,
          count: savedCount,
          correlation_id: correlation.correlationId
        }
      });

    } catch (err) {
      logger.error("GENERATION_PROCESS_FAILED", err.message, { stack: err.stack });
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
    await processGeneration();
    return new Response(JSON.stringify({ 
      status: "completed", 
      specialty,
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
