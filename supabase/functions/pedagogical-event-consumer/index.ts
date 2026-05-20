import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";

/**
 * Pedagogical Event Consumer — Master Recalculator
 * Responsável por reagir a eventos e atualizar o estado cognitivo longitudinal do aluno.
 */
Deno.serve(enterpriseEdgeHandler("pedagogical-event-consumer", async ({ req, logger, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { event } = body;

  if (!event || !event.event_type) {
    return new Response(JSON.stringify({ success: false, error: "Event payload missing" }), { status: 400 });
  }

  logger.info("CONSUME_START", `Processing event: ${event.event_type}`, { eventId: event.id });

  try {
    // 1. Identificar tipo de evento e disparar ações adaptativas
    switch (event.event_type) {
      case 'simulado_error_detected':
      case 'tutor_question_answered':
        if (event.metadata?.is_correct === false) {
          logger.info("ADAPT_ERROR", "Triggering error bank registration and planner priority boost");
          
          // Incrementar erro no banco de erros
          await supabaseAdmin.rpc("increment_error_count", {
            p_user_id: user.id,
            p_topic: event.study_context?.topic || 'Geral',
            p_subtopic: event.study_context?.subtopic || null
          });

          // Aumentar prioridade no Planner Longitudinal
          await supabaseAdmin.from("study_plan_items")
            .update({ priority_score: 95 })
            .match({ user_id: user.id, topic: event.study_context?.topic })
            .eq("status", "pending");
        }
        break;

      case 'planner_task_completed':
        logger.info("ADAPT_PROGRESS", "Updating longitudinal progress and approval predictor");
        
        // Marcar item do planner como completo (se id estiver presente)
        if (event.study_context?.study_plan_item_id) {
          await supabaseAdmin.from("study_plan_items")
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq("id", event.study_context.study_plan_item_id);
        }

        // Trigger predictor recalculation
        await supabaseAdmin.functions.invoke("performance-predictor", {
          body: { userId: user.id, trigger: "event_bus_completion" }
        });
        break;

      case 'quality_lock_failed':
        logger.warn("GOVERNANCE_ALERT", "AI Quality lock failure detected. Creating incident.");
        await supabaseAdmin.from("ai_incidents").insert({
          severity: 'warning',
          incident_type: 'quality_lock_failed',
          message: `Quality lock failed for module: ${event.module}`,
          metadata: event.metadata
        });
        break;
    }

    // 2. Marcar como consumido (Idempotência)
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "pedagogical-master-recalculator",
      success: true
    });

    return new Response(JSON.stringify({ success: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    logger.error("CONSUME_ERROR", err.message, { eventId: event.id });
    
    await supabaseAdmin.rpc("mark_pedagogical_event_consumed", {
      event_id: event.id,
      consumer_name: "pedagogical-master-recalculator",
      success: false,
      result_metadata: { error: err.message }
    });

    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}));
