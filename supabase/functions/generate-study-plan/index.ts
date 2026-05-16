// generate-study-plan - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

Deno.serve(enterpriseEdgeHandler("generate-study-plan", async ({ req, logger, waitUntil, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { examDate, hoursPerDay, daysPerWeek } = body;

  const { data: plan } = await supabaseAdmin.from("study_plans").insert({ user_id: user.id, status: "processing" }).select("id").single();

  waitUntil((async () => {
    try {
      const aiResponse = await callAi({
        model: ALLOWED_MODELS.generation,
        messages: [{ role: "user", content: `Gere plano de estudos para prova em ${examDate}` }],
      }, logger, supabaseAdmin);
      const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "");
      await supabaseAdmin.from("study_plans").update({ plan_json: planJson, status: "completed" }).eq("id", plan.id);
    } catch (err) {
      await supabaseAdmin.from("study_plans").update({ status: "error", error_message: err.message }).eq("id", plan.id);
    }
  })());

  return new Response(JSON.stringify({ success: true, planId: plan.id }), { status: 202, headers: { "Content-Type": "application/json" } });
}));
