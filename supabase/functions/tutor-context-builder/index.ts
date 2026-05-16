// tutor-context-builder - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Adaptive context enrichment for personalized learning.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("tutor-context-builder", async ({ req, logger, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH
  const { user } = await requireAuth(req);
  logger.info("AUTH", "User authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const { topic, subtopic } = body;

  logger.info("BUILD_CONTEXT", "Aggregating adaptive metrics", { topic, subtopic });

  // 3. AGGREGATE DATA (Parallel)
  const [profileRes, weakTopicsRes, fsrsRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("target_exam, target_banca, faculdade").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("error_bank").select("tema, subtema, vezes_errado").eq("user_id", user.id).order("vezes_errado", { ascending: false }).limit(5),
    supabaseAdmin.from("fsrs_cards").select("id, card_ref_id, due").eq("user_id", user.id).lte("due", new Date().toISOString()).limit(5)
  ]);

  const ctx = {
    user_id: user.id,
    target_exam: profileRes.data?.target_exam || profileRes.data?.target_banca,
    weak_topics: weakTopicsRes.data || [],
    fsrs_due_count: fsrsRes.data?.length || 0,
    session_context: { topic, subtopic },
    meta: {
      generated_at: new Date().toISOString(),
      source: "enterprise-context-builder"
    }
  };

  logger.info("CONTEXT_READY", "Adaptive context generated successfully");

  return new Response(JSON.stringify(ctx), {
    headers: { "Content-Type": "application/json" }
  });
});
