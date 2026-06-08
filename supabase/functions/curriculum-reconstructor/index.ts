import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { AI_MODELS } from "../_shared/ai-models.ts";

/**
 * ENAZIZI — CURRICULUM RECONSTRUCTOR ENGINE (Phase 3-5)
 * Classification, Confidence Gate & Sampling
 */

const CRITICAL_TOPICS = [
  "IAM com supra", "Sepse", "AVC", "Hipercalemia", "CAD", 
  "Pré-natal", "Metrorragia", "Apendicite", "Pneumonia", "Insuficiência cardíaca"
];

Deno.serve(enterpriseEdgeHandler("curriculum-reconstructor", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai } = enterpriseContext;
  
  try {
    const { action, batch_size = 100, limit = 500 } = await req.json();

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

      // Fetch orphans for Phase 4
      const { data: orphans } = await supabaseAdmin.rpc('audit_orphans');
      
      // Fetch War Room data (Phase 13)
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

    if (action === "classify_sentinel" || action === "classify_batch") {
      const actualLimit = action === "classify_sentinel" ? 500 : limit;
      
      // 1. Fetch IDs already in staging to avoid duplicates
      const { data: existingStaging } = await supabaseAdmin
        .from("question_classification_staging")
        .select("question_id");
      
      const existingIds = existingStaging?.map(s => s.question_id) || [];

      // 2. Fetch questions not yet in staging
      let query = supabaseAdmin
        .from("questions_bank")
        .select("id, statement, explanation, topic, subtopic");

      if (existingIds.length > 0) {
        query = query.not("id", "in", `(${existingIds.join(",")})`);
      }

      const { data: questions, error: fetchError } = await query.limit(actualLimit);

      if (fetchError) throw fetchError;
      if (!questions || questions.length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No questions to classify" }), { headers: corsHeaders });
      }

      // 2. Fetch canonical curriculum for context
      const { data: registry } = await supabaseAdmin
        .from("curriculum_registry")
        .select("curriculum_area, curriculum_theme, curriculum_subtheme, competency_id");

      const registryContext = registry?.slice(0, 100).map(r => 
        `${r.curriculum_area} > ${r.curriculum_theme} > ${r.curriculum_subtheme} (ID: ${r.competency_id})`
      ).join("\n");

      // 3. Create Batch Entry
      const { data: batchEntry, error: batchError } = await supabaseAdmin
        .from("classification_batches")
        .insert({
          batch_size: questions.length,
          model_used: AI_MODELS.REASONING,
          prompt_version: "v3.5-curriculum-exact",
          status: "processing"
        })
        .select()
        .single();

      if (batchError) throw batchError;

      const results = [];
      let totalCost = 0;

      // 4. Process in chunks of 10 (AI handles small batches better for accuracy)
      for (let i = 0; i < questions.length; i += 10) {
        const chunk = questions.slice(i, i + 10);
        
        const prompt = `Você é um Auditor Médico Sênior. Sua missão é classificar questões para o currículo ENAZIZI.
        REGRA DE OURO: Use apenas os competency_id fornecidos se houver correspondência exata. Se não, sugira um novo ID seguindo o padrão AREA_THEME_SUBTHEME.

        Currículo de Referência (Amostra):
        ${registryContext}

        Questões para classificar:
        ${chunk.map((q, idx) => `
        --- QUESTÃO ${idx} (ID: ${q.id}) ---
        Statement: ${q.statement.substring(0, 800)}
        Topic/Subtopic Legado: ${q.topic} / ${q.subtopic}
        `).join('\n')}

        Retorne um JSON no formato:
        {
          "classifications": [
            {
              "question_id": "uuid",
              "predicted_area": "string",
              "predicted_theme": "string",
              "predicted_subtheme": "string",
              "predicted_competency": "string",
              "competency_id": "string",
              "confidence_score": 0.98,
              "reasoning_summary": "string"
            }
          ]
        }`;

        const aiResponse = await ai({
          model: AI_MODELS.REASONING,
          messages: [{ role: "system", content: "Você é um classificador médico rigoroso." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(aiResponse.choices[0].message.content || '{"classifications":[]}');
        const batchResults = parsed.classifications || [];

        // 5. Cross-Validation for Critical Topics
        for (const res of batchResults) {
          const isCritical = CRITICAL_TOPICS.some(t => 
            res.predicted_theme?.includes(t) || res.predicted_subtheme?.includes(t)
          );

          if (isCritical) {
            const auditPrompt = `VALIDE ESTA CLASSIFICAÇÃO CRÍTICA.
            Statement da Questão: ${chunk.find(q => q.id === res.question_id)?.statement?.substring(0, 1000)}
            Classificação Proposta: ${res.predicted_theme} > ${res.predicted_subtheme}
            
            Pergunta: Esta questão trata especificamente do tema ${res.predicted_theme} / ${res.predicted_subtheme}?
            Responda APENAS JSON: {"confirmed": boolean, "alternative_competency_id": "string", "reason": "string"}`;

            const auditResponse = await ai({
              model: AI_MODELS.FAST,
              messages: [{ role: "user", content: auditPrompt }],
              response_format: { type: "json_object" }
            });

            const auditParsed = JSON.parse(auditResponse.choices[0].message.content || "{}");
            res.cross_validated = true;
            if (!auditParsed.confirmed) {
              res.confidence_score = Math.min(res.confidence_score, 0.7); // Drop confidence if auditor disagrees
              res.validation_divergence = auditParsed.reason;
            }
          }

          // 6. Apply Confidence Gates Status
          let status = "manual_review_required";
          if (res.confidence_score >= 0.95) {
            status = "auto_approved_pending_sample";
          } else if (res.confidence_score >= 0.80) {
            status = "sample_review_required";
          }

          // 7. Save to Staging
          await supabaseAdmin.from("question_classification_staging").insert({
            question_id: res.question_id,
            batch_id: batchEntry.id,
            predicted_area: res.predicted_area,
            predicted_theme: res.predicted_theme,
            predicted_subtheme: res.predicted_subtheme,
            predicted_competency: res.predicted_competency,
            competency_id: res.competency_id,
            confidence_score: res.confidence_score,
            reasoning_summary: res.reasoning_summary,
            classification_status: status,
            model_used: AI_MODELS.REASONING,
            prompt_version: "v3.5-curriculum-exact",
            cross_validated: res.cross_validated || false,
            validation_divergence: res.validation_divergence || null
          });

          results.push({ ...res, status });
        }
      }

      // 8. Finalize Batch Report
      const stats = results.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {} as any);

      await supabaseAdmin.from("classification_batches").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        quality_report: {
          stats,
          critical_topics_processed: results.filter(r => r.cross_validated).length,
        }
      }).eq("id", batchEntry.id);

      return new Response(JSON.stringify({ 
        success: true, 
        batch_id: batchEntry.id,
        processed: results.length,
        stats 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400, headers: corsHeaders });

  } catch (err) {
    logger.critical("RECONSTRUCTOR_CRASH", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
}));