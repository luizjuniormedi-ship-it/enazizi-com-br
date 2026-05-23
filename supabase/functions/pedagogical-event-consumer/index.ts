import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

/**
 * ENAZIZI ALOS — Fase 3: Cognitive State Machine (Final)
 * Master Orchestrator for pedagogical events and cognitive transitions.
 */
Deno.serve(enterpriseEdgeHandler("pedagogical-event-consumer", async ({ req, logger, supabaseAdmin }) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { event } = body;

  if (!event || !event.id) {
    return new Response(JSON.stringify({ success: false, error: "Event payload missing" }), { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const correlationId = event.correlation_id || event.metadata?.correlation_id;
  
  logger.info("COG_RUNTIME_PROCESS", `Event: ${event.event_type}`, { 
    userId: user.id, 
    module: event.module,
    correlationId,
    recursion: event.recursion_depth 
  });

  try {
    // 1. Idempotency Check
    if (event.idempotency_key) {
      const { data: existing } = await supabaseAdmin
        .from("pedagogical_events")
        .select("status")
        .eq("idempotency_key", event.idempotency_key)
        .eq("status", "consumed")
        .maybeSingle();
      
      if (existing) {
        logger.info("IDEMPOTENCY_HIT", "Event already consumed", { key: event.idempotency_key });
        return new Response(JSON.stringify({ success: true, duplicated: true }), { headers: corsHeaders });
      }
    }

    // 2. Resolve Cognitive State
    let { data: cogState } = await supabaseAdmin
      .from("cognitive_states")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!cogState) {
      const { data: newState } = await supabaseAdmin
        .from("cognitive_states")
        .insert({ 
          user_id: user.id, 
          state: 'novato',
          retention_score: 50, 
          cognitive_load: 10,
          metadata: { initial_sync: true }
        })
        .select()
        .single();
      cogState = newState;
    }

    // 3. Cognitive State Machine Transitions
    const updates: any = {};
    const metadata: any = { 
      last_event_type: event.event_type,
      previous_state: cogState.state 
    };

    // Calculate metrics base
    let errorPressure = cogState.error_pressure || 0;
    let cognitiveLoad = cogState.cognitive_load || 0;
    let retentionScore = cogState.retention_score || 0;
    let trajectoryHealth = cogState.trajectory_health || 0;

    switch (event.event_type) {
      case 'question_answered':
      case 'simulado_error_detected':
      case 'tutor_question_answered':
        const isCorrect = event.metadata?.is_correct === true;
        const difficulty = event.metadata?.difficulty || 'medium';
        
        if (!isCorrect) {
          errorPressure = Math.min(100, errorPressure + 12);
          cognitiveLoad = Math.min(100, cognitiveLoad + 8);
          retentionScore = Math.max(0, retentionScore - 3);
          
          // SIDE EFFECT: Register in Error Bank
          await supabaseAdmin.from("error_bank").upsert({
            user_id: user.id,
            tema: event.study_context?.topic || "Geral",
            subtema: event.study_context?.subtopic || null,
            question_id: event.entity_id || null,
            tipo_questao: event.module === 'simulado' ? 'simulado' : 'objetiva',
            vezes_errado: 1,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, tema, subtema, question_id' });
        } else {
          errorPressure = Math.max(0, errorPressure - 4);
          cognitiveLoad = Math.max(0, cognitiveLoad - 2);
          retentionScore = Math.min(100, retentionScore + 2);
          trajectoryHealth = Math.min(100, trajectoryHealth + 1);
        }
        break;

      case 'planner_task_completed':
        trajectoryHealth = Math.min(100, trajectoryHealth + 5);
        cognitiveLoad = Math.max(0, cognitiveLoad - 15);
        break;
      
      case 'fsrs_overdue_detected':
        errorPressure = Math.min(100, errorPressure + 5);
        break;
    }

    // --- Formal State Machine Transitions ---
    let nextState = cogState.state;

    if (cogState.state === 'novato') {
      if (retentionScore > 40) nextState = 'exposto';
    } else if (cogState.state === 'exposto') {
      if (retentionScore > 60 && errorPressure < 30) nextState = 'praticando';
      if (errorPressure > 70) nextState = 'retencao_fraca';
    } else if (cogState.state === 'retencao_fraca') {
      if (errorPressure < 40) nextState = 'recuperacao';
    } else if (cogState.state === 'praticando') {
      if (retentionScore > 85) nextState = 'consolidacao';
      if (errorPressure > 60) nextState = 'retencao_fraca';
    } else if (cogState.state === 'consolidacao') {
      if (retentionScore > 95) nextState = 'dominio';
    } else if (cogState.state === 'dominio') {
      if (errorPressure > 50) nextState = 'risco_esquecimento';
    } else if (cogState.state === 'risco_esquecimento') {
      if (errorPressure < 30) nextState = 'dominio';
    }

    if (nextState !== cogState.state) {
      updates.state = nextState;
      metadata.state_transition_at = new Date().toISOString();
      logger.info("COG_STATE_TRANSITION", `Changed from ${cogState.state} to ${nextState}`, { userId: user.id });
    }

    updates.error_pressure = errorPressure;
    updates.cognitive_load = cognitiveLoad;
    updates.retention_score = retentionScore;
    updates.trajectory_health = trajectoryHealth;

    // 4. Persist Updates
    await supabaseAdmin
      .from("cognitive_states")
      .update({ 
        ...updates, 
        metadata: { ...cogState.metadata, ...metadata }, 
        last_event_id: event.id, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", cogState.id);

    // 5. Trigger Systemic Recalculations (Async)
    if (nextState !== cogState.state || errorPressure > 70) {
      // Trigger Planner Engine
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/autonomous-planner-engine`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: user.id, trigger_event: event.event_type })
      }).catch(e => logger.error("PLANNER_TRIGGER_FAIL", e.message));
    }

    // 6. Audit & Mark Consumed
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "alos-cognitive-runtime-v3",
      success: true,
      result_metadata: { applied_updates: updates, transition: nextState !== cogState.state ? { from: cogState.state, to: nextState } : null }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      state_transition: nextState !== cogState.state,
      current_state: nextState
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.error("COG_RUNTIME_FAIL", err.message, { eventId: event.id, stack: err.stack });
    
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "alos-cognitive-runtime-v3",
      success: false,
      result_metadata: { error: err.message, stack: err.stack }
    });

    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}));