// generate-study-plan - ENAZIZI MASTER PLANNER ENGINE
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";


Deno.serve(enterpriseEdgeHandler("generate-study-plan", async ({ req, logger, waitUntil, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { examDate, hoursPerDay, daysPerWeek, editalText, strictMode, performanceData, existingSubjects } = body;

  logger.info("PLAN_GEN_START", "Starting Master Planner Generation", { 
    userId: user.id, 
    examDate, 
    hoursPerDay, 
    daysPerWeek 
  });

  const { data: plan, error: insertErr } = await supabaseAdmin
    .from("study_plans")
    .insert({ 
      user_id: user.id, 
      status: "processing",
      current_step: "Iniciando motor ENAZIZI Master Planner...",
      progress: 5
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;

  waitUntil((async () => {
    try {
      await supabaseAdmin.from("study_plans").update({ current_step: "Analisando telemetria e histórico do aluno...", progress: 15 }).eq("id", plan.id);

      // 0. Fetch latest processed material and detected exam date
      let materialText = editalText;
      let detectedExamDate: string | null = null;
      let lastUploadId: string | null = null;
      
      const { data: lastUpload } = await supabaseAdmin
        .from("uploads")
        .select("id, extracted_text, extracted_json")
        .eq("user_id", user.id)
        .eq("status", "processed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (lastUpload) {
        if (!materialText && lastUpload.extracted_text) {
          materialText = lastUpload.extracted_text;
          logger.info("MATERIAL_FOUND", "Using last processed upload as edital text");
        }
        detectedExamDate = (lastUpload.extracted_json as any)?.detected_exam_date;
        lastUploadId = lastUpload.id;
      }

      // 1. Resolve Final Exam Date (Priority: Manual > Extracted)
      const finalExamDate = examDate || detectedExamDate;
      if (!finalExamDate) {
        throw new Error("Data da prova não informada e não detectada no edital. Por favor, informe a data manualmente.");
      }

      // Validate date
      const examDateObj = new Date(finalExamDate);
      const today = new Date();
      if (examDateObj < today) {
        throw new Error("A data da prova informada já passou. Por favor, escolha uma data futura.");
      }

      const daysUntilExam = Math.ceil((examDateObj.getTime() - today.getTime()) / 86400000);
      const weeksUntilExam = Math.max(1, Math.floor(daysUntilExam / 7));

      // 2. Fetch extracted topics with evidence (Strictly from the linked upload)
      const { data: extractedTopics } = await supabaseAdmin
        .from("planner_extracted_topics")
        .select("*")
        .eq("user_id", user.id)
        .eq("upload_id", lastUploadId)
        .eq("validation_status", "extracted")
        .not("raw_excerpt", "is", null);

      const [revisoesRes, errorsRes, profileRes, fsrsRes] = await Promise.all([
        supabaseAdmin.from("revisoes")
          .select("tema_id, status, data_revisao")
          .eq("user_id", user.id)
          .eq("status", "pendente")
          .limit(50),
        supabaseAdmin.from("error_bank")
          .select("tema, subtema, vezes_errado")
          .eq("user_id", user.id)
          .eq("dominado", false)
          .order("vezes_errado", { ascending: false })
          .limit(10),
        supabaseAdmin.from("profiles")
          .select("level, study_streak, target_exams")
          .eq("user_id", user.id)
          .single(),
        supabaseAdmin.from("fsrs_cards")
          .select("card_type, stability, difficulty")
          .eq("user_id", user.id)
          .limit(50)
      ]);

      await supabaseAdmin.from("study_plans").update({ current_step: "Processando evidências e mapeando temas...", progress: 25 }).eq("id", plan.id);

      
      const systemPrompt = `Você é o motor oficial de geração de cronograma do ENAZIZI.

Sua missão é criar um plano de estudos médico COMPLETO e LONGITUDINAL, cobrindo todo o período desde hoje até a data da prova.

Você NÃO é um gerador de tarefas para uma única semana. Você deve distribuir todo o conteúdo necessário ao longo das semanas disponíveis.

────────────────────────────
1. OBJETIVO
────────────────────────────

Criar um cronograma estratégico total que:

- cubra todo o edital fornecido;
- distribua os temas de forma lógica e progressiva ao longo das semanas;
- respeite a carga horária semanal disponível;
- priorize temas de maior incidência e disciplinas onde o aluno tem mais dificuldade;
- deixe semanas finais para revisão intensiva e simulados.

────────────────────────────
2. REGRAS DE DISTRIBUIÇÃO
────────────────────────────

- Calcule quantas horas totais o aluno tem até a prova.
- Estime o tempo necessário para cada tema do edital.
- Aloque os temas nas semanas (week_number).
- Garanta que temas pré-requisitos venham antes.
- Se houver pouco tempo, priorize temas de alta incidência (80/20 rule).

────────────────────────────
3. SAÍDA ESPERADA (JSON OBRIGATÓRIO)
────────────────────────────

Retorne APENAS um JSON no seguinte formato:
{
  "fullSchedule": [
    {
      "week_number": 1,
      "focus": "Título da fase ou foco da semana",
      "topics": [
        {
          "topic": "...",
          "discipline": "...",
          "priority_score": 0-100,
          "estimated_minutes": 120,
          "difficulty": "facil|medio|dificil"
        }
      ]
    }
  ],
  "subjects": ["..."],
  "insights": {
    "total_weeks": 0,
    "feasibility": "low|medium|high",
    "strategy_summary": "..."
  },
  "metadata": {
    "engine": "ENAZIZI Longitudinal Planner",
    "version": "3.0"
  }
}

────────────────────────────
4. REGRAS CRÍTICAS
────────────────────────────

- Nunca gere apenas uma semana se houver várias semanas até a prova.
- Se o edital for muito grande para o tempo disponível, sinalize nos insights e priorize o essencial.
- Mantenha a coerência pedagógica.`;

      const userContext = {
        availability: `${hoursPerDay}h/dia, ${daysPerWeek} dias/semana`,
        totalWeeklyHours: (hoursPerDay || 4) * (daysPerWeek || 5),
        examDate: finalExamDate,
        daysUntilExam,
        weeksUntilExam,
        strictMode,
        extractedTopics: extractedTopics?.map(t => ({
          topic: t.topic,
          subtopic: t.subtopic,
          discipline: t.discipline,
          evidence: t.raw_excerpt
        })).slice(0, 150),
        performance: {
          provided: performanceData || "Perfil novo",
          existingSubjects: existingSubjects || [],
          errors: errorsRes.data || [],
          pendingReviewsCount: revisoesRes.data?.length || 0,
          studentLevel: profileRes.data?.level || "beginner",
          targetExams: profileRes.data?.target_exams || [],
          fsrsRetentionSnapshot: fsrsRes.data?.slice(0, 10) || []
        }
      };

      await supabaseAdmin.from("study_plans").update({ current_step: "Gerando estratégia longitudinal com IA...", progress: 50 }).eq("id", plan.id);


      const aiResponse = await ai({
        taskType: "planner",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere o Plano Longitudinal Completo (${weeksUntilExam} semanas) para: ${JSON.stringify(userContext)}` }
        ],
        complexity: "high",
        model: "google/gemini-2.0-flash-001"
      });

      const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
      
      if (!planJson.weeklySchedule) {
        throw new Error("Erro na estrutura do Master Planner: weeklySchedule ausente.");
      }

      // Record governance log
      try {
        await supabaseAdmin.from("ai_governance_logs").insert({
          user_id: user.id,
          task_type: "study_plan_generation",
          model_name: "google/gemini-2.5-flash", 
          payload: { context: userContext },
          response_summary: "Master Planner Generated"
        });
      } catch (logErr) {
        logger.warn("GOVERNANCE_LOG_FAIL", logErr.message);
      }

      // Update study_plan with metadata and start/end dates
      const startDate = new Date().toISOString().split("T")[0];
      const totalAvailableMinutes = (hoursPerDay || 4) * (daysPerWeek || 5) * weeksUntilExam * 60;
      
      await supabaseAdmin.from("study_plans").update({ 
        plan_json: planJson, 
        status: "completed",
        current_step: "Master Planner Concluído com Sucesso",
        progress: 100,
        exam_date: finalExamDate,
        daily_available_minutes: (hoursPerDay || 4) * 60,
        weekly_available_days: daysPerWeek || 5,
        total_available_minutes: totalAvailableMinutes,
        start_date: startDate,
        end_date: finalExamDate,
        source: extractedTopics && extractedTopics.length > 0 ? "pdf_edital" : "manual"
      }).eq("id", plan.id);

      // Populate study_plan_items
      const topicMap = planJson.topicMap || [];
      if (topicMap.length > 0) {
        const itemsToInsert = topicMap.map((t: any, idx: number) => {
          // Find original evidence if available - Anti-hallucination check
          const evidence = extractedTopics?.find(et => et.topic === t.topic);
          
          return {
            study_plan_id: plan.id,
            user_id: user.id,
            discipline: t.discipline || t.subject || evidence?.discipline || "Geral",
            topic: t.topic,
            subtopic: t.subtopics?.[0] || evidence?.subtopic || null,
            priority_score: t.priority_score || 50,
            difficulty: t.difficulty || 'medio',
            source: evidence ? 'extracted' : 'incidencia',
            source_page: evidence?.source_page || null,
            source_chunk_id: evidence?.source_chunk_id || null, 
            raw_excerpt: evidence?.raw_excerpt || null,
            week_number: Math.floor(idx / 5) + 1,
            status: 'pending'
          };
        });

        // Filter items that must have evidence if strictMode is on (implicit policy)
        const filteredItems = itemsToInsert.filter(item => {
          if (extractedTopics && extractedTopics.length > 0) {
             return item.source === 'extracted';
          }
          return true; // Fallback to incidence only if no PDF was provided
        });

        // Insert in small batches to avoid limits
        for (let i = 0; i < filteredItems.length; i += 20) {
          const { error: itemsErr } = await supabaseAdmin.from("study_plan_items").insert(filteredItems.slice(i, i + 20));
          if (itemsErr) logger.error("ITEMS_INSERT_FAIL", itemsErr.message);
        }
      }


      logger.info("PLAN_GEN_SUCCESS", "Study plan generated successfully", { planId: plan.id });

    } catch (err) {
      logger.error("PLAN_GEN_ERROR", err.message, { planId: plan.id });
      await supabaseAdmin.from("study_plans").update({ 
        status: "error", 
        error_message: err.message,
        current_step: "Falha na geração do Planner" 
      }).eq("id", plan.id);
    }
  })());

  return new Response(JSON.stringify({ success: true, planId: plan.id }), { 
    status: 202, 
    headers: { ...corsHeaders, "Content-Type": "application/json" } 
  });

}));