// generate-study-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Personalized weekly study scheduling with edital analysis.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

Deno.serve(enterpriseEdgeHandler("generate-study-plan", async ({ req, logger, waitUntil, correlation, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH
  const { user, supabaseAdmin } = await requireAuth(req);
  logger.info("AUTH", "User authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const { examDate, hoursPerDay, daysPerWeek, currentPlanId, editalText } = body;

  if (!examDate || !hoursPerDay || !daysPerWeek) {
    throw new Error("Missing required fields: examDate, hoursPerDay, daysPerWeek");
  }

  // 3. INITIALIZE PLAN RECORD
  let planId = currentPlanId;
  if (planId) {
    await supabaseAdmin.from("study_plans").update({
      status: "processing",
      progress: 0,
      current_step: "Iniciando...",
      error_message: null
    }).eq("id", planId).eq("user_id", user.id);
  } else {
    const { data, error } = await supabaseAdmin.from("study_plans").insert({
      user_id: user.id,
      status: "processing",
      progress: 0,
      current_step: "Iniciando...",
      plan_json: { status: "initializing" }
    }).select("id").single();
    if (error) throw error;
    planId = data.id;
  }

  // 4. BACKGROUND PROCESSING
  const processPlan = async () => {
    try {
      logger.info("PLAN_GENERATION_START", "Analyzing edital and generating schedule", { planId });

      const prompt = `Gere um cronograma semanal de estudos para residência médica.
Prova: ${examDate}
Horas/dia: ${hoursPerDay}h
Dias/semana: ${daysPerWeek} dias
Edital: ${editalText ? editalText.slice(0, 5000) : "Não fornecido"}

Retorne APENAS JSON: {"weeklySchedule": [{"day": "Seg", "tasks": [{"time": "08:00", "subject": "...", "duration": "2h", "type": "estudo"}]}]}`;

      const aiResponse = await callAi({
        model: ALLOWED_MODELS.generation,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4000,
      }, logger, supabaseAdmin);

      const aiContent = aiResponse.choices?.[0]?.message?.content || "";
      const planJson = parseAiJson(aiContent);

      await supabaseAdmin.from("study_plans").update({
        plan_json: {
          ...planJson,
          config: { examDate, hoursPerDay, daysPerWeek },
          generated_at: new Date().toISOString()
        },
        status: "completed",
        progress: 100,
        current_step: "Finalizado"
      }).eq("id", planId);

      logger.info("PLAN_GENERATION_SUCCESS", "Study plan generated and saved", { planId });

    } catch (err) {
      logger.error("PLAN_GENERATION_FAILED", err.message, { planId, stack: err.stack });
      await supabaseAdmin.from("study_plans").update({
        status: "error",
        error_message: err.message
      }).eq("id", planId);
    }
  };

  waitUntil(processPlan());

  return new Response(JSON.stringify({ 
    success: true, 
    planId,
    correlation_id: correlation.correlationId 
  }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
