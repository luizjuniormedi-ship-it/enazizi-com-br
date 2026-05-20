import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

/**
 * ENAZIZI ALOS — Fase 2.5: Cognitive Event Consumer (Hardened)
 * Master Orchestrator que interpreta o stream de eventos e atualiza o Cognitive State.
 */
Deno.serve(enterpriseEdgeHandler("pedagogical-event-consumer", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { event } = body;

  if (!event || !event.id) {
    return new Response(JSON.stringify({ success: false, error: "Event payload missing" }), { status: 400 });
  }

  logger.info("COG_RUNTIME_PROCESS", `Event: ${event.event_type}`, { 
    userId: user.id, 
    module: event.module,
    recursion: event.recursion_depth 
  });

  try {
    // 1. Resolve Cognitive State Baseline
    let { data: cogState } = await supabaseAdmin
      .from("cognitive_states")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cogState) {
      const { data: newState } = await supabaseAdmin
        .from("cognitive_states")
        .insert({ user_id: user.id, retention_score: 50, cognitive_load: 10 })
        .select()
        .single();
      cogState = newState;
    }

    // 2. Event-Sourced Adaptations
    const updates: any = {};
    const metadata: any = { last_event_type: event.event_type };

    switch (event.event_type) {
      case 'simulado_error_detected':
      case 'tutor_question_answered':
        if (event.metadata?.is_correct === false) {
          updates.error_pressure = Math.min(100, (cogState.error_pressure || 0) + 15);
          updates.cognitive_load = Math.min(100, (cogState.cognitive_load || 0) + 5);
          updates.retention_score = Math.max(0, (cogState.retention_score || 0) - 2);
          
          // Trigger Autonomous Recovery Intervention
          if (updates.error_pressure > 70) {
            metadata.anomaly_detected = 'high_error_pressure';
            await supabaseAdmin.from("pedagogical_events").insert({
              user_id: user.id,
              event_type: 'cognitive_anomaly_detected',
              module: 'governance',
              source: 'system',
              severity: 'warning',
              recursion_depth: (event.recursion_depth || 0) + 1,
              metadata: { type: 'error_pressure_peak', current_value: updates.error_pressure }
            });
          }
        }
        break;

      case 'planner_task_completed':
        updates.planner_consistency = Math.min(100, (cogState.planner_consistency || 0) + 10);
        updates.cognitive_load = Math.max(0, (cogState.cognitive_load || 0) - 10);
        updates.trajectory_health = Math.min(100, (cogState.trajectory_health || 0) + 5);
        break;

      case 'fsrs_overdue_detected':
        updates.fatigue_risk = Math.min(100, (cogState.fatigue_risk || 0) + 20);
        break;
    }

    // 3. Persist Cognitive State Evolution
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("cognitive_states")
        .update({ ...updates, metadata: { ...cogState.metadata, ...metadata }, last_event_id: event.id, updated_at: new Date().toISOString() })
        .eq("id", cogState.id);
    }

    // 4. Finalize Consumption (Audit Trail)
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "cognitive-event-runtime-v2.5",
      success: true,
      result_metadata: { applied_updates: updates }
    });

    return new Response(JSON.stringify({ success: true, cog_updated: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.error("COG_RUNTIME_FAIL", err.message, { eventId: event.id });
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "cognitive-event-runtime-v2.5",
      success: false,
      result_metadata: { error: err.message }
    });
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}));

