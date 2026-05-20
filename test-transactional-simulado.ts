import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qszsyskumcmuknumwxtk.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VALID_USER_ID = "095cf92f-427d-48e1-accc-31b357b2fa50";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runTransactionTest() {
  console.log("=== INICIANDO REAL SIMULADO TRANSACTION TEST ===");
  const report: any = {
    payload_enviado: {},
    funcao_chamada: "question-generator",
    session_id: null,
    numero_questoes: 0,
    tabelas_atualizadas: [],
    ultimo_step: "start",
    bugs_encontrados: [],
    correções_aplicadas: []
  };

  try {
    // 1. Gerar 5 questões sobre TEP
    console.log("\n[Passo 1-4] Chamando question-generator com fluxo real...");
    const payload = {
      stream: false,
      outputFormat: "json",
      difficulty: "misto",
      messages: [{
        role: "user",
        content: "Gere 5 questões sobre TEP (Tromboembolismo Pulmonar)."
      }],
      generationContext: {
        specialty: "Clínica Médica",
        topic: "TEP",
        objective: "practice",
        source: "simulado",
        board: "Geral"
      },
      count: 5,
      forceAi: true,
      saveToBank: true,
      createSession: true,
      userId: VALID_USER_ID,
      bypassAuth: true
    };
    report.payload_enviado = payload;

    const { data: result, error: invokeErr } = await supabase.functions.invoke("question-generator", {
      body: payload
    });

    if (invokeErr) {
      report.bugs_encontrados.push(`Erro na função: ${invokeErr.message}`);
      throw invokeErr;
    }

    if (!result?.success || !result?.session_id) {
      report.bugs_encontrados.push("Função retornou sucesso: false ou sem session_id");
      throw new Error("Falha na geração");
    }

    report.session_id = result.session_id;
    report.numero_questoes = result.questions?.length || 0;
    report.ultimo_step = result.step || "complete";
    console.log(`Sucesso! Session ID: ${report.session_id}, Questões: ${report.numero_questoes}`);

    // 2. Verificar registros reais no banco
    console.log("\n[Passo 3] Verificando vínculos em simulado_questions...");
    const { data: links, error: linkErr } = await supabase
      .from("simulado_questions")
      .select("*")
      .eq("session_id", report.session_id);

    if (linkErr) {
      report.bugs_encontrados.push(`Erro ao buscar links: ${linkErr.message}`);
    } else if (!links || links.length === 0) {
      report.bugs_encontrados.push("Nenhum registro em simulado_questions encontrado via SDK");
    } else {
      report.tabelas_atualizadas.push("simulado_questions");
      console.log(`Encontrados ${links.length} vínculos no banco.`);
      
      // 3. Simular resposta e finalização
      console.log("\n[Passo 6-12] Simulando respostas e finalização...");
      
      const responses = links.slice(0, 2).map(l => ({
        session_id: report.session_id,
        question_id: l.question_id,
        user_id: VALID_USER_ID,
        is_correct: Math.random() > 0.5,
        time_spent_ms: 15000,
        metadata: { simulated: true }
      }));

      const { error: respErr } = await supabase.from("simulado_attempts").insert(responses);
      if (!respErr) {
        report.tabelas_atualizadas.push("simulado_attempts");
        console.log("Respostas inseridas.");
      }

      // Finalizar simulado
      const { error: finalErr } = await supabase
        .from("simulado_sessions")
        .update({ 
          status: 'finished', 
          finished_at: new Date().toISOString(),
          score: 50,
          correct_answers: 1,
          total_questions: 2
        })
        .eq("id", report.session_id);

      if (!finalErr) {
        report.tabelas_atualizadas.push("simulado_sessions");
        console.log("Sessão finalizada.");
      }
    }

  } catch (e) {
    console.error("Erro no teste transacional:", e.message);
    report.bugs_encontrados.push(`Exception: ${e.message}`);
  }

  console.log("\nRELATÓRIO DE TRANSAÇÃO:");
  console.log(JSON.stringify(report, null, 2));
}

runTransactionTest();
