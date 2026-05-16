// upgrade-questions - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Robust AI-driven question upgrading with full governance.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

Deno.serve(enterpriseEdgeHandler("upgrade-questions", async ({ req, logger, waitUntil, correlation, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH & ADMIN CHECK
  const { user, supabaseAdmin } = await requireAdmin(req);
  logger.info("AUTH", "Admin authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batch_size || 5, 10);
  const ids: string[] | undefined = body.ids;

  logger.info("FETCH_QUESTIONS", "Querying questions for upgrade", { batchSize, idsCount: ids?.length });

  let query = supabaseAdmin.from("questions_bank")
    .select("id, statement, options, correct_index, topic, explanation, source")
    .in("quality_tier", ["needs_upgrade", "basic"])
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (ids && ids.length > 0) {
    query = supabaseAdmin.from("questions_bank")
      .select("id, statement, options, correct_index, topic, explanation, source")
      .in("id", ids)
      .limit(batchSize);
  }

  const { data: questions, error: fetchError } = await query;
  if (fetchError) throw fetchError;

  if (!questions || questions.length === 0) {
    logger.info("FINISHED", "No questions found to upgrade");
    return new Response(JSON.stringify({ message: "Nenhuma questão pendente", upgraded: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. BACKGROUND EXECUTION LOGIC
  const processUpgrade = async () => {
    let upgraded = 0;
    let failed = 0;

    for (const q of questions) {
      try {
        logger.info("AI_UPGRADE_START", `Upgrading question ${q.id}`, { questionId: q.id });
        
        const prompt = `Você é um professor elaborador de questões de ELITE para residência médica.
Transforme o enunciado abaixo em um CASO CLÍNICO DE ALTA COMPLEXIDADE padrão "prova real".

ENUNCIADO ORIGINAL: "${q.statement}"
TEMA: ${q.topic}

REGRAS:
1. Gere um caso clínico realista.
2. Mantenha o gabarito original.
3. Retorne APENAS um JSON: {"statement": "...", "explanation": "..."}`;

        const aiResponse = await callAi({
          model: ALLOWED_MODELS.reasoning,
          messages: [
            { role: "system", content: "Professor de medicina de elite. Responda APENAS JSON." },
            { role: "user", content: prompt }
          ],
          max_tokens: 2000,
        }, logger, supabaseAdmin);

        const aiContent = aiResponse.choices?.[0]?.message?.content || "";
        if (!aiContent) throw new Error("AI returned empty content");

        const parsed = parseAiJson(aiContent);
        
        if (parsed.statement && parsed.statement.length > 200) {
          await supabaseAdmin.from("questions_bank").update({
            statement: sanitizeAiContent(parsed.statement),
            explanation: sanitizeAiContent(parsed.explanation),
            quality_tier: "exam_standard",
            review_status: "approved",
            updated_at: new Date().toISOString(),
            source: q.source ? `${q.source}|ai-upgraded` : "ai-upgraded",
          }).eq("id", q.id);
          upgraded++;
          logger.info("UPGRADE_SUCCESS", `Question ${q.id} updated successfully`);
        } else {
          throw new Error("AI output invalid or too short");
        }
      } catch (err) {
        failed++;
        logger.error("UPGRADE_FAILED", `Failed for question ${q.id}`, { error: err.message });
      }

      // Small delay between AI calls to stay within limits if needed
      await new Promise(r => setTimeout(r, 500));
    }

    // Pipeline tracking
    try {
      await supabaseAdmin.from("pipeline_governance").insert({
        pipeline_name: "upgrade-questions",
        function_name: "upgrade-questions",
        status: failed === 0 ? "completed" : (upgraded > 0 ? "partial" : "failed"),
        model_used: ALLOWED_MODELS.reasoning,
        completed_at: new Date().toISOString(),
        user_id: user.id,
        metadata: {
          upgraded,
          failed,
          total: questions.length,
          correlation_id: correlation.correlationId
        }
      });
    } catch (govErr) {
      logger.warn("GOVERNANCE_FAIL", "Failed to log final governance", { error: govErr.message });
    }
  };

  // 4. RETURN IMMEDIATE OR WAIT
  const isBackground = body.background === true;
  if (isBackground) {
    waitUntil(processUpgrade());
    return new Response(JSON.stringify({ 
      status: "processing", 
      batch_size: questions.length,
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } else {
    await processUpgrade();
    return new Response(JSON.stringify({ 
      status: "completed", 
      processed: questions.length,
      correlation_id: correlation.correlationId 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});
