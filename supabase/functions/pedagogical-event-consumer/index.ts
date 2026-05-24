
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

/**
 * ENAZIZI ALOS — Fase 2.5: Cognitive Event Consumer (Hardened v10)
 * Blind orchestrator that ensures events are processed without interrupting UX.
 */
Deno.serve(enterpriseEdgeHandler("pedagogical-event-consumer", async ({ req, logger, supabaseAdmin, waitUntil }) => {
  // Always allow OPTIONS for CORS preflight
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

    // v10: Never return 400. Always 200 OK for telemetria safety.
    if (!event) {
      console.warn("[EVENT_CONSUMER_BLIND] Payload missing, returning silent success.");
      return new Response(JSON.stringify({ success: true, message: "Ignored empty payload" }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const eventId = event.id ?? event.idempotency_key ?? crypto.randomUUID();
    const userId = user?.id ?? event.user_id;

    if (!userId) {
      console.warn("[EVENT_CONSUMER_BLIND] No user context, dropping event.");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

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
        await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
          event_id: eventId,
          consumer_name: "cognitive-runtime-v10",
          success: true
        });

      } catch (innerErr) {
        console.error("[EVENT_PROCESS_FAIL]", innerErr.message);
      }
    })());

    return new Response(JSON.stringify({ success: true, blind_ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.error("COG_RUNTIME_CRITICAL_FAIL", err.message);
    // Still return 200 for stability
    return new Response(JSON.stringify({ success: false, silent: true }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));
