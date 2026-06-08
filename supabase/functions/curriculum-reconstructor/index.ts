import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { AI_MODELS } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — MCME (MASS CURRICULUM MATERIALIZATION EXECUTION)
 * Dual Validation Engine (Phase 2-3)
 */

Deno.serve(enterpriseEdgeHandler("curriculum-reconstructor", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai } = enterpriseContext;
  
  try {
    const { action, limit = 50, batch_size = 5 } = await req.json().catch(() => ({}));

    if (action === "inventory_report") {
      const { data: pmcReport } = await supabaseAdmin.rpc('get_pmc_report').catch(() => ({ data: null }));
      
      const { data: stats } = await supabaseAdmin.rpc('rebuild_curriculum_metrics');
      
      const { data: orphans } = await supabaseAdmin.rpc('audit_orphans').catch(() => ({ data: [] }));
      
      return new Response(JSON.stringify({ 
        success: true, 
        stats,
        orphans: orphans?.slice(0, 10) || []
      }), { headers: corsHeaders });
    }

    if (action === "mcme_mass_execute") {
      // 1. Fetch unmaterialized but approved questions
      const { data: questions, error: fetchError } = await supabaseAdmin
        .from("questions_bank")
        .select("id, statement, topic, subtopic")
        .eq("approved_for_generation", true)
        .is("competency_id", null)
        .limit(limit);

      if (fetchError) throw fetchError;
      if (!questions || questions.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "Materialization complete" }), { headers: corsHeaders });
      }

      // 2. Fetch Curriculum Registry for context
      const { data: registry } = await supabaseAdmin
        .from("curriculum_registry")
        .select("curriculum_area, curriculum_theme, curriculum_subtheme, curriculum_competency, competency_id")
        .limit(100);

      const registryText = registry?.map(r => 
        `- [${r.competency_id}] ${r.curriculum_area} > ${r.curriculum_theme} > ${r.curriculum_subtheme} (${r.curriculum_competency})`
      ).join("\n");

      let processedCount = 0;

      for (let i = 0; i < questions.length; i += batch_size) {
        const chunk = questions.slice(i, i + batch_size);
        
        // DUAL VALIDATION: Principal Classifier
        const promptPrincipal = `Classificador Principal ENAZIZI GOLD.
        Materialize estas questões no currículo abaixo. Use apenas IDs do currículo.
        
        Currículo:
        ${registryText}

        Questões:
        ${chunk.map(q => `ID: ${q.id} | Contexto: ${q.topic} > ${q.subtopic} | Enunciado: ${q.statement.substring(0, 300)}`).join('\n')}

        Retorne JSON: {"results": [{"id": "uuid", "competency_id": "uuid", "confidence": 0.95}]}`;

        const respPrincipal = await ai({
          model: AI_MODELS.FAST,
          messages: [{ role: "system", content: "Expert em materialização curricular médica." }, { role: "user", content: promptPrincipal }],
          response_format: { type: "json_object" }
        });

        const principalResults = JSON.parse(respPrincipal.choices[0].message.content).results;

        // DUAL VALIDATION: Auditor Classifier
        const promptAuditor = `Auditor ENAZIZI GOLD. 
        Valide a materialização para estas questões.
        Questões: ${chunk.map(q => `ID: ${q.id} | Contexto: ${q.topic} > ${q.subtopic}`).join('\n')}
        Retorne JSON: {"results": [{"id": "uuid", "competency_id": "uuid"}]}`;

        const respAuditor = await ai({
          model: AI_MODELS.FAST,
          messages: [{ role: "system", content: "Auditor rigoroso de currículo médico." }, { role: "user", content: promptAuditor }],
          response_format: { type: "json_object" }
        });

        const auditorResults = JSON.parse(respAuditor.choices[0].message.content).results;

        // Conciliation & Execution
        for (const p of principalResults) {
          const a = auditorResults.find(res => res.id === p.id);
          const isValidated = a && a.competency_id === p.competency_id;

          if (isValidated && p.confidence >= 0.90) {
            // Success: Persist Materialization
            await supabaseAdmin.from("questions_bank").update({
              competency_id: p.competency_id,
              classification_method: 'MCME_DUAL_AI_V1',
              classification_confidence: p.confidence,
              classified_at: new Date().toISOString()
            }).eq("id", p.id);
            processedCount++;
          }
        }
      }

      // 3. Rebuild metrics
      await supabaseAdmin.rpc('rebuild_curriculum_metrics');

      return new Response(JSON.stringify({ 
        success: true, 
        materialized: processedCount,
        total_in_batch: questions.length 
      }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400, headers: corsHeaders });

  } catch (err) {
    logger.critical("MCME_CRASH", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}));
