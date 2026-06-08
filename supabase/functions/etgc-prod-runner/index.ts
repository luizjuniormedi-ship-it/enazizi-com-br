import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { TopicEngine } from "../_shared/topic-engine.ts";
import { validateFinalQuestionTopic } from "../_shared/topic-guard.ts";

Deno.serve(enterpriseEdgeHandler("etgc-prod-runner", async (enterpriseContext) => {
  const { req, logger, supabaseAdmin, ai, correlation } = enterpriseContext;
  const { correlationId } = correlation;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "inventory"; // inventory, run_batch, summary
    
    if (action === "inventory") {
      // PHASE 1: INVENTÁRIO CURRICULAR
      const { data: registry, error } = await supabaseAdmin
        .from("curriculum_registry")
        .select("specialty, curriculum_theme, competency_id, curriculum_competency")
        .order("competency_id", { ascending: true });

      if (error) throw error;

      return new Response(JSON.stringify({ 
        success: true, 
        count: registry.length,
        items: registry.map(r => ({
          specialty: r.specialty,
          topic_id: r.curriculum_theme,
          competency_id: r.competency_id,
          competency_name: r.curriculum_competency
        }))
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "run_batch") {
      const competencyIds = body.competency_ids || [];
      const results = [];

      const topicEngine = new TopicEngine(supabaseAdmin);

      for (const compId of competencyIds) {
        const startTime = Date.now();
        
        // Fetch competency details
        const { data: comp } = await supabaseAdmin
          .from("curriculum_registry")
          .select("*")
          .eq("competency_id", compId)
          .single();

        if (!comp) continue;

        const sizes = [10, 20, 50];
        const batchResults: any = {
          returned_10: 0,
          returned_20: 0,
          returned_50: 0,
          trace_ids: [],
          total_exact_match: 0,
          total_questions: 0,
          leakage_detected: 0
        };

        for (const size of sizes) {
          // PHASE 2: EXECUÇÃO REAL (Simulated via internal call to generate-adaptive-simulado logic)
          // We call the same core logic instead of the HTTP endpoint to avoid network overhead/auth issues
          // But it's functionally identical.
          
          // Actually, let's call the function itself if we want "exact same endpoint"
          const { data: genResult, error: genError } = await supabaseAdmin.functions.invoke("generate-adaptive-simulado", {
            body: {
              target_question_count: size,
              selectedTopics: [comp.curriculum_theme],
              selectedSubtopics: [comp.curriculum_competency],
              mode: 'real_production_test'
            }
          });

          if (genError || !genResult?.success) {
            console.error(`[ETGC_GEN_ERROR] compId=${compId} size=${size}`, genError || genResult?.error);
            continue;
          }

          const questions = genResult.questions || [];
          batchResults[`returned_${size}`] = questions.length;
          batchResults.trace_ids.push(genResult.session_id);

          // PHASE 3: PUREZA TEMÁTICA & PHASE 5: LEAKAGE
          for (const q of questions) {
            batchResults.total_questions++;
            
            // Re-validate using TopicGuard (Same as used in prod)
            const guard = validateFinalQuestionTopic(q, comp.curriculum_theme, comp.curriculum_competency);
            
            if (guard.allowed) {
              batchResults.total_exact_match++;
            } else {
              if (guard.reason === "topic_mismatch" || guard.reason === "contaminated") {
                batchResults.leakage_detected++;
              }
            }
          }
        }

        // PHASE 4: TPS
        const tps = batchResults.total_questions > 0 
          ? (batchResults.total_exact_match / batchResults.total_questions) * 100 
          : 0;

        // Status logic
        let status = "VERDE";
        if (tps < 95 || batchResults.returned_10 < 10) status = "AMARELO";
        if (tps < 80 || batchResults.returned_10 === 0) status = "VERMELHO";

        const executionTime = Date.now() - startTime;

        const resultEntry = {
          competency_id: compId,
          competency_name: comp.curriculum_competency,
          returned_10_count: batchResults.returned_10,
          returned_20_count: batchResults.returned_20,
          returned_50_count: batchResults.returned_50,
          tps: parseFloat(tps.toFixed(2)),
          leakage_count: batchResults.leakage_detected,
          status,
          execution_time_ms: executionTime,
          trace_ids: batchResults.trace_ids,
          metrics: batchResults
        };

        // Save to DB
        await supabaseAdmin.from("etgc_certification_results").upsert(resultEntry, { onConflict: 'competency_id' });
        results.push(resultEntry);
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, results }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "summary") {
      // PHASE 14: MÉTRICAS FINAIS
      const { data: allResults } = await supabaseAdmin
        .from("etgc_certification_results")
        .select("*");

      if (!allResults) throw new Error("No results found");

      const total = allResults.length;
      const green = allResults.filter(r => r.status === "VERDE").length;
      const yellow = allResults.filter(r => r.status === "AMARELO").length;
      const red = allResults.filter(r => r.status === "VERMELHO").length;
      
      const cts = (green / 163) * 100; // Based on the expected total
      const tps_avg = allResults.reduce((acc, r) => acc + (Number(r.tps) || 0), 0) / total;
      const leakage_total = allResults.reduce((acc, r) => acc + (r.leakage_count || 0), 0);
      const questions_total = allResults.reduce((acc, r) => acc + (r.metrics?.total_questions || 0), 0);
      const leakage_avg = questions_total > 0 ? (leakage_total / questions_total) * 100 : 0;
      const avg_time = allResults.reduce((acc, r) => acc + (r.execution_time_ms || 0), 0) / total;

      const summary = {
        total_competencies: total,
        green_count: green,
        yellow_count: yellow,
        red_count: red,
        cts: parseFloat(cts.toFixed(2)),
        tps_avg: parseFloat(tps_avg.toFixed(2)),
        topic_leakage_avg: parseFloat(leakage_avg.toFixed(2)),
        avg_execution_time: parseFloat(avg_time.toFixed(2)),
        is_certified: cts >= 95 && tps_avg >= 95 && leakage_avg <= 5 && total >= 163
      };

      await supabaseAdmin.from("etgc_certification_summary").insert({
        ...summary,
        full_report: { results: allResults }
      });

      return new Response(JSON.stringify({ success: true, summary }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}), {
  // We need to allow longer execution for batches
  timeout: 120000 
});
