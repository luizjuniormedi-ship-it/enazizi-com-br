// ENAZIZI — tutor-memory-feedback (v22.1)
// Recebe feedback do aluno (👍/👎/🚫) sobre uma resposta reutilizada da memória.
// Body: { memoryId: uuid, feedback: 'up'|'down'|'hallucination', note?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth via JWT (verify_jwt = false por padrão; validamos aqui)
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "missing_authorization" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "invalid_token" }, 401);
  }
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const memoryId = String(body?.memoryId || "").trim();
  const feedback = String(body?.feedback || "").trim();
  const note = body?.note ? String(body.note).slice(0, 1000) : null;

  if (!/^[0-9a-f-]{36}$/i.test(memoryId)) return json({ error: "invalid_memory_id" }, 400);
  if (!["up", "down", "hallucination"].includes(feedback)) {
    return json({ error: "invalid_feedback" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { error: rpcErr } = await admin.rpc("tutor_memory_register_feedback", {
    _memory_id: memoryId,
    _user_id: userId,
    _feedback: feedback,
    _note: note,
  });
  if (rpcErr) {
    console.error("[FEEDBACK_RPC_ERROR]", rpcErr.message);
    return json({ error: "feedback_failed", details: rpcErr.message }, 500);
  }

  // Atualiza métricas diárias
  try {
    const day = new Date().toISOString().slice(0, 10);
    const field =
      feedback === "up"
        ? "feedback_up"
        : feedback === "down"
        ? "feedback_down"
        : "feedback_halluc";
    await admin.rpc("memory_metrics_increment", { _day: day, _field: field, _delta: 1 });
  } catch (e: any) {
    console.warn("[FEEDBACK_METRIC_ERROR]", e?.message);
  }

  console.log("[FEEDBACK_OK]", { memoryId, feedback, userId });
  return json({ ok: true });
});
