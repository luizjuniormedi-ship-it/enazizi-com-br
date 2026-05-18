// generate-study-plan - ENAZIZI MASTER PLANNER ENGINE
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
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

      // 0. Fetch latest processed material if editalText is missing
      let materialText = editalText;
      if (!materialText) {
        const { data: lastUpload } = await supabaseAdmin
          .from("uploads")
          .select("extracted_text")
          .eq("user_id", user.id)
          .eq("status", "processed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lastUpload?.extracted_text) {
          materialText = lastUpload.extracted_text;
          logger.info("MATERIAL_FOUND", "Using last processed upload as edital text");
        }
      }

      // 1. Fetch rich student context

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

      await supabaseAdmin.from("study_plans").update({ current_step: "Processando edital e mapeando temas...", progress: 25 }).eq("id", plan.id);

      
      const systemPrompt = `Você é o motor oficial de geração de cronograma do ENAZIZI.

Sua missão é criar um plano de estudos médico completo, inteligente, realista e adaptativo baseado no perfil do aluno, edital, prova, PDF enviado, desempenho e tempo disponível.

Você NÃO é um gerador genérico de tarefas.
Você funciona como um estrategista pedagógico de alta performance.

────────────────────────────
1. OBJETIVO
────────────────────────────

Criar um cronograma completo e coerente que:

- cubra todo o edital;
- respeite o tempo disponível;
- priorize temas de maior incidência;
- priorize disciplinas fracas;
- integre revisões FSRS;
- integre simulados;
- integre Banco de Erros;
- integre Tutor IA;
- gere Missão do Dia;
- adapte-se conforme desempenho futuro.

────────────────────────────
2. DADOS DE ENTRADA
────────────────────────────

Receber:
- prova-alvo;
- data da prova;
- tempo diário disponível;
- disciplinas;
- desempenho atual;
- erros recentes;
- PDFs/editais;
- revisões pendentes;
- simulados anteriores;
- nível do aluno;
- temas prioritários;
- peso por disciplina;
- frequência de incidência;
- risco FSRS;
- histórico de retenção.

────────────────────────────
3. PROCESSAMENTO DE PDF (SE HOUVER)
────────────────────────────

Se houver conteúdo de PDF:
1. Extrair TODO o conteúdo;
2. Dividir em chunks;
3. Consolidar tópicos;
4. Remover duplicados;
5. Detectar temas reais;
6. Rejeitar temas inventados;
7. Validar coerência;
8. Marcar origem de cada tópico.

PROIBIDO:
- inventar assuntos;
- adicionar tema fora do documento;
- ignorar páginas;
- criar tópicos genéricos.

────────────────────────────
4. LÓGICA DE PRIORIZAÇÃO
────────────────────────────

Prioridade deve considerar:

PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (DomínioAtual × 2)

Também considerar:
- tempo sem revisar;
- recorrência de erro;
- dificuldade da disciplina;
- carga horária restante;
- fadiga cognitiva;
- equilíbrio semanal.

────────────────────────────
5. ESTRUTURA DO CRONOGRAMA
────────────────────────────

Cada dia deve conter:
1. Aula principal;
2. Explicação Tutor IA;
3. Questões;
4. Revisão FSRS;
5. Banco de Erros;
6. Flashcards;
7. Mini revisão;
8. Mini simulado (quando necessário);
9. Resumo do dia.

Cada tarefa precisa ter:
- título;
- disciplina;
- tema;
- prioridade;
- duração;
- tipo;
- dificuldade;
- origem;
- objetivo;
- integração com outros módulos.

────────────────────────────
6. ADAPTAÇÃO
────────────────────────────

O cronograma deve se recalcular automaticamente quando:
- aluno atrasa tarefas;
- aluno erra muito;
- aluno melhora desempenho;
- surgem revisões vencidas;
- surgem novos erros;
- prova se aproxima;
- tempo diário muda.

────────────────────────────
7. SAÍDA ESPERADA (JSON OBRIGATÓRIO)
────────────────────────────

Retorne APENAS um JSON no seguinte formato:
{
  "weeklySchedule": [
    {
      "day": "Segunda-feira",
      "tasks": [
        {
          "title": "...",
          "subject": "...",
          "topic": "...",
          "priority": 0-100,
          "duration": "...min",
          "type": "theory|practice|review|error_fix",
          "details": "...",
          "integration": "Tutor IA + Questões"
        }
      ]
    }
  ],
  "subjects": ["..."],
  "topicMap": [
    {
      "topic": "...",
      "subtopics": ["...", "..."],
      "priority_score": 0-100,
      "source": "edital|incidencia"
    }
  ],
  "insights": {
    "themes_critical": ["..."],
    "risk_of_delay": "low|medium|high",
    "recovery_plan": "..."
  },
  "metadata": {
    "engine": "ENAZIZI Master Planner",
    "version": "2.0"
  }
}

────────────────────────────
8. REGRAS CRÍTICAS
────────────────────────────

Nunca:
- criar cronograma impossível;
- sobrecarregar o aluno;
- ignorar revisões;
- inventar conteúdo;
- gerar tarefas vagas.

Sempre:
- justificar prioridades;
- equilibrar teoria/prática/revisão;
- otimizar retenção.`;

      const userContext = {
        availability: `${hoursPerDay}h/dia, ${daysPerWeek} dias/semana`,
        examDate,
        strictMode,
        editalText: materialText ? materialText.slice(0, 5000) : "Use incidência médica Brasil (ENARE, USP, SUS-SP)",
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

      await supabaseAdmin.from("study_plans").update({ current_step: "Gerando estratégia pedagógica com IA...", progress: 50 }).eq("id", plan.id);


      const aiResponse = await ai({
        taskType: "planner",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere o Master Planner para: ${JSON.stringify(userContext)}` }
        ],
        complexity: "high",
        model: "google/gemini-2.5-flash"
      });

      const planJson = parseAiJson(aiResponse.choices?.[0]?.message?.content || "{}");
      
      if (!planJson.weeklySchedule) {
        throw new Error("Erro na estrutura do Master Planner: weeklySchedule ausente.");
      }

      // Record governance log with model name to avoid constraint violation
      try {
        await supabaseAdmin.from("ai_governance_logs").insert({
          user_id: user.id,
          task_type: "study_plan_generation",
          model_name: "google/gemini-2.5-flash", // Using a valid production model
          payload: { context: userContext },
          response_summary: "Master Planner Generated"
        });

      } catch (logErr) {
        logger.warn("GOVERNANCE_LOG_FAIL", logErr.message);
      }

      await supabaseAdmin.from("study_plans").update({ 
        plan_json: planJson, 
        status: "completed",
        current_step: "Master Planner Concluído com Sucesso",
        progress: 100
      }).eq("id", plan.id);

      // Trigger automatic FSRS/Sync for the first 10 topics if needed
      // This helps with the "not separating topics" complaint
      const topics = planJson.topicMap || [];
      if (topics.length > 0) {
        logger.info("SYNC_START", `Syncing ${topics.length} topics to student modules`);
        // Here we could call an internal function or just log it
        // The frontend usually handles the detailed sync via cronogramaSync.ts
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
    headers: { "Content-Type": "application/json" } 
  });
}));