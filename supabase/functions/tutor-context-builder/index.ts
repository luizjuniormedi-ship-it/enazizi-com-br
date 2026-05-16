// tutor-context-builder - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

Deno.serve(enterpriseEdgeHandler("tutor-context-builder", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const [profile, weak] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("error_bank").select("*").eq("user_id", user.id).limit(5)
  ]);
  return new Response(JSON.stringify({ user_id: user.id, profile: profile.data, weak_topics: weak.data }), {
    headers: { "Content-Type": "application/json" }
  });
}));
