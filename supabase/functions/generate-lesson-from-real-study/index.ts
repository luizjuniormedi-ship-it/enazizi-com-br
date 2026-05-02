import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * EducationalInterestEngine — Motor de detecção pedagógica.
 * Calcula se um tema merece uma videoaula automática.
 */
class EducationalInterestEngine {
  private THRESHOLD = 85; // Score mínimo para gerar aula

  calculateScore(tracking: any): number {
    let score = 0;
    
    // Peso por interações (perguntas, cliques)
    score += Math.min(tracking.interaction_count * 5, 30);
    
    // Peso por tempo de estudo (em segundos, ex: 10 min = 600s)
    score += Math.min((tracking.total_study_time / 60) * 2, 20);
    
    // Atividades proativas
    score += tracking.flashcards_generated * 10;
    score += tracking.questions_answered * 8;
    score += tracking.fsrs_reviews * 5;
    score += tracking.related_errors * 12; // Erros aumentam muito o interesse pedagógico

    return Math.min(score, 100);
  }

  shouldGenerate(score: number): boolean {
    return score >= this.THRESHOLD;
  }

  getGenerationReason(tracking: any, score: number): string {
    if (tracking.related_errors > 3) return "Alta taxa de erros no tema";
    if (tracking.interaction_count > 15) return "Múltiplas dúvidas e aprofundamento";
    if (tracking.flashcards_generated > 5) return "Forte intenção de memorização";
    if (score >= 95) return "Interesse pedagógico excepcional";
    return "Consolidação de estudo recorrente";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const admin = createClient(supabaseUrl, serviceKey);
    const engine = new EducationalInterestEngine();

    const body = await req.json().catch(() => ({}));
    const { user_id, topic, force = false } = body;

    if (!user_id || !topic) {
      return new Response(JSON.stringify({ error: "user_id and topic required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 0. Rollout Control - Verificar se a feature está ativa para este usuário
    const { data: hasAccess, error: accessErr } = await admin.rpc("check_feature_access", {
      f_name: "tutor_lesson_automation",
      u_id: user_id
    });

    if (accessErr) {
      console.error("Access check error:", accessErr);
    }

    if (!hasAccess && !force) {
      return new Response(JSON.stringify({ status: "skipped", reason: "rollout_restricted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar dados de rastreamento do tema para este usuário
    const { data: tracking, error: trackErr } = await admin
      .from("tutor_study_tracking")
      .select("*")
      .eq("user_id", user_id)
      .eq("topic", topic)
      .maybeSingle();

    if (trackErr) throw trackErr;

    // Se não tiver dados suficientes e não for force, abortar
    if (!tracking && !force) {
      return new Response(JSON.stringify({ status: "skipped", reason: "no_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const score = tracking ? engine.calculateScore(tracking) : 100;
    const shouldGen = force || engine.shouldGenerate(score);

    if (!shouldGen) {
      return new Response(JSON.stringify({ status: "skipped", score, threshold: 85 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verificar se já existe uma aula pendente ou publicada sobre este tema exato para este user (Deduplicação)
    const { data: existing } = await admin
      .from("tutor_lesson_memory")
      .select("id, status")
      .eq("user_id", user_id)
      .eq("topic", topic)
      .not("status", "eq", "archived")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ status: "skipped", reason: "already_exists", lesson_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Criar registro inicial da aula (Central de Produção ENAFLIX)
    const reason = tracking ? engine.getGenerationReason(tracking, score) : "Solicitação manual via IA";
    const { data: lesson, error: insErr } = await admin
      .from("tutor_lesson_memory")
      .insert({
        user_id,
        topic,
        subject: tracking?.subject || "Medicina",
        generated_from_real_usage: true,
        pedagogical_interest_score: score,
        generation_reason: reason,
        study_sessions_count: tracking?.session_count || 1,
        tutor_messages_count: tracking?.interaction_count || 0,
        related_error_bank_count: tracking?.related_errors || 0,
        related_fsrs_reviews: tracking?.fsrs_reviews || 0,
        related_questions_count: tracking?.questions_answered || 0,
        production_pipeline_status: "awaiting_structure",
        admin_review_required: true,
        status: "draft"
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // 4. Registrar evento
    await admin.from("tutor_lesson_events").insert({
      lesson_id: lesson.id,
      actor_id: user_id,
      event_type: "lesson_auto_detected",
      metadata: { score, reason, topic, rollout: true }
    });

    // 5. Chamar a function de estruturação (NotebookLM/Gemini/Google Vids)
    const structureUrl = `${supabaseUrl}/functions/v1/tutor-lesson-structure`;
    fetch(structureUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ lesson_id: lesson.id })
    }).catch(err => console.error("Error triggering structure:", err));

    return new Response(JSON.stringify({ 
      status: "success", 
      lesson_id: lesson.id,
      score,
      reason,
      rollout_active: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-lesson-from-real-study:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
