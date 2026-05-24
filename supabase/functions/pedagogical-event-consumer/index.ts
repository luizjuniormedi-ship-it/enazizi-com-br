import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

/**
 * ENAZIZI ALOS — Fase 2.5: Cognitive Event Consumer (Hardened v11)
 * Blind orchestrator that ensures events are processed without interrupting UX.
 * v11: Unified CORS, NON-BLOCKING, NEVER returns 400.
 */
Deno.serve(enterpriseEdgeHandler("pedagogical-event-consumer", async ({ req, logger, supabaseAdmin, waitUntil }) => {
  // Always allow OPTIONS for CORS preflight (redundant due to enterpriseEdgeHandler but good for clarity)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Attempt Auth, but don't crash if it fails (system events might call this)
    let user = null;
    try {
      const auth = await requireAuth(req);
      user = auth.user;
    } catch (e) {
      console.info("[SYSTEM_EVENT_CONSUMPTION] Anonymous or System call.");
    }

    const body = await req.json().catch(() => ({}));
    const { event } = body;

    // v11: NEVER return 400. Always 200 OK for telemetria safety.
    if (!event) {
      console.warn("[PEDAGOGICAL_EVENT_IGNORED] Payload missing, returning silent success.");
      return corsResponse({ success: true, ignored: true, message: "No event payload" }, 200);
    }

    const eventId = event.id ?? event.idempotency_key ?? crypto.randomUUID();
    const userId = user?.id ?? event.user_id;

    if (!userId) {
      console.warn("[PEDAGOGICAL_EVENT_IGNORED] No user context, dropping event.");
      return corsResponse({ success: true, ignored: true, message: "No user context" }, 200);
    }

    console.info("[PREFLIGHT_OK] Event received", { eventType: event.event_type, eventId });

    // PROCESS ASYNC: Don't wait for state updates to respond
    waitUntil((async () => {
      try {
        // 1. Resolve Cognitive State
        let { data: cogState } = await supabaseAdmin
          .from("cognitive_states")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!cogState) {
          const { data: newState } = await supabaseAdmin
            .from("cognitive_states")
            .insert({ user_id: userId, retention_score: 50, cognitive_load: 10 })
            .select()
            .single();
          cogState = newState;
        }

        // 2. State Logic
        const updates: any = {};
        if (event.event_type === 'simulado_error_detected' || event.metadata?.is_correct === false) {
          updates.error_pressure = Math.min(100, (cogState.error_pressure || 0) + 15);
        }

        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from("cognitive_states")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", cogState.id);
        }

        // 3. Mark Consumed
        const { error: rpcErr } = await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
          event_id: eventId,
          consumer_name: "cognitive-runtime-v11",
          success: true
        });

        if (!rpcErr) {
          console.info("[UPSERT_OK] Event consumed successfully");
        }

      } catch (innerErr) {
        console.error("[EDGE_SAFE_FAIL] Event process fail", innerErr.message);
      }
    })());

    return corsResponse({ 
      success: true, 
      blind_ok: true,
      log: "[CORS_OK]"
    }, 200);

  } catch (err) {
    logger.error("COG_RUNTIME_CRITICAL_FAIL", err.message);
    // [EDGE_SAFE_FAIL] Always return 200 for stability
    return corsResponse({ 
      success: false, 
      silent: true, 
      error: err.message,
      log: "[EDGE_SAFE_FAIL]"
    }, 200);
  }
}));
