import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { AI_MODELS } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — CURRICULUM RECONSTRUCTOR ENGINE (Phase 3-5)
 * Optimized for Mass Materialization (MCME)
 */

const CRITICAL_TOPICS = [
  "IAM com supra", "Sepse", "AVC", "Hipercalemia", "CAD", 
  "Pré-natal", "Metrorragia", "Apendicite", "Pneumonia", "Insuficiência cardíaca"
];

Deno.serve(enterpriseEdgeHandler("curriculum-reconstructor", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai } = enterpriseContext;
  
  try {
    const { action, batch_size = 20, limit = 100 } = await req.json().catch(() => ({}));

    if (action === "inventory_report") {
      const { data: pmcReport } = await supabaseAdmin.rpc('get_pmc_report');
      
      const { count: totalQuestions } = await supabaseAdmin
        .from("questions_bank")
        .select("*", { count: "exact", head: true });

      const { count: unclassified } = await supabaseAdmin
        .from("questions_bank")
        .select("*", { count: "exact", head: true })
        .is("topic_id", null);

      const { data: lastBatch } = await supabaseAdmin
        .from("classification_batches")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: orphans } = await supabaseAdmin.rpc('audit_orphans');
      
      const { data: warRoom } = await supabaseAdmin
        .from("curriculum_topics")
        .select("nome, visible_questions, rps, status")
        .order("visible_questions", { ascending: true })
        .limit(50);

      return new Response(JSON.stringify({ 
        success: true, 
        total: totalQuestions,
        unclassified,
        classified: (totalQuestions || 0) - (unclassified || 0),
        last_batch_id: lastBatch?.id,
        pmc_report: pmcReport,
        orphans: orphans || [],
        war_room: warRoom || []
      }), { headers: corsHeaders });
    }

    if (action === "classify_batch") {
      const actualLimit = limit;
      
      const { data: questions, error: fetchError } = await supabaseAdmin
        .rpc('get_unclassified_questions', { p_limit: actualLimit });

      if (fetchError) throw fetchError;
      if (!questions || questions.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No questions to classify" }), { headers: corsHeaders });
      }

      const { data: registry } = await supabaseAdmin
        .from("curriculum_registry")
        .select("curriculum_area, curriculum_theme, curriculum_subtheme, competency_id");

      const registryContext = registry?.slice(0, 50).map(r => 
        `${r.curriculum_area} > ${r.curriculum_theme} > ${r.curriculum_subtheme} (ID: ${r.competency_id})`
      ).join("\n");

      const { data: batchEntry, error: batchError } = await supabaseAdmin
        .from("classification_batches")
        .insert({
          batch_size: questions.length,
          model_used: AI_MODELS.FAST,
          prompt_version: "v3.6-mass-materialization",
          status: "processing"
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const results = [];

      for (let i = 0; i < questions.length; i += batch_size) {
        const chunk = questions.slice(i, i + batch_size);
        
        const prompt = `Classifique estas questões médicas para o currículo ENAZIZI GOLD.
        
        Currículo (Amostra):
        ${registryContext}

        Questões:
        ${chunk.map((q, idx) => `
        ID: ${q.id}
        Statement: ${q.statement.substring(0, 600)}
        Legacy: ${q.topic} / ${q.subtopic}
        `).join('\n')}

        Retorne JSON:
        {
          "classifications": [
            {
              "question_id": "uuid",
              "predicted_area": "string",
              "predicted_theme": "string",
              "predicted_subtheme": "string",
              "predicted_competency": "string",
              "competency_id": "string",
              "confidence_score": 0.99
            }
          ]
        }`;

        const aiResponse = await ai({
          model: AI_MODELS.FAST,
          messages: [{ role: "system", content: "Você é um classificador médico sênior." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(aiResponse.choices[0].message.content || '{"classifications":[]}');
        const batchResults = parsed.classifications || [];

        for (const res of batchResults) {
          let status = "approved"; // Default to approved for mass materialization
          if (res.confidence_score < 0.70) status = "manual_review_required";

          await supabaseAdmin.from("question_classification_staging").insert({
            question_id: res.question_id,
            batch_id: batchEntry.id,
            predicted_area: res.predicted_area,
            predicted_theme: res.predicted_theme,
            predicted_subtheme: res.predicted_subtheme,
            predicted_competency: res.predicted_competency,
            competency_id: res.competency_id,
            confidence_score: res.confidence_score,
            classification_status: status,
            model_used: AI_MODELS.FAST,
            prompt_version: "v3.6-mass-materialization"
          });

          results.push({ ...res, status });
        }
      }

      await supabaseAdmin.from("classification_batches").update({
        status: "completed",
        completed_at: new Date().toISOString()
      }).eq("id", batchEntry.id);

      return new Response(JSON.stringify({ 
        success: true, 
        batch_id: batchEntry.id,
        processed: results.length
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400, headers: corsHeaders });

  } catch (err) {
    logger.critical("RECONSTRUCTOR_CRASH", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}));