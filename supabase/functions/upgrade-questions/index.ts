// upgrade-questions - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { parseAiJson, sanitizeAiContent } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

Deno.serve(enterpriseEdgeHandler("upgrade-questions", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  const { user } = await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batch_size || 5, 10);
  const ids: string[] | undefined = body.ids;

  let query = supabaseAdmin.from("questions_bank")
    .select("id, statement, options, correct_index, topic, explanation, source")
    .in("quality_tier", ["needs_upgrade", "basic"])
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (ids && ids.length > 0) {
    query = supabaseAdmin.from("questions_bank").select("*").in("id", ids).limit(batchSize);
  }

  const { data: questions, error: fetchError } = await query;
  if (fetchError) throw fetchError;

  const processUpgrade = async () => {
    for (const q of (questions || [])) {
      try {
        const aiResponse = await callAi({
          model: ALLOWED_MODELS.reasoning,
          messages: [{ role: "user", content: `Upgrade medical question: ${q.statement}` }],
          max_tokens: 2000,
        }, logger, supabaseAdmin);
        const parsed = parseAiJson(aiResponse.choices?.[0]?.message?.content || "");
        if (parsed.statement) {
          await supabaseAdmin.from("questions_bank").update({
            statement: sanitizeAiContent(parsed.statement),
            explanation: sanitizeAiContent(parsed.explanation),
            quality_tier: "exam_standard",
            updated_at: new Date().toISOString(),
          }).eq("id", q.id);
        }
      } catch (err) {
        logger.error("UPGRADE_FAIL", err.message);
      }
    }
  };

  if (body.background) {
    waitUntil(processUpgrade());
    return new Response(JSON.stringify({ status: "processing" }), { headers: { "Content-Type": "application/json" } });
  } else {
    await processUpgrade();
    return new Response(JSON.stringify({ status: "completed" }), { headers: { "Content-Type": "application/json" } });
  }
}));
