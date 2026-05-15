import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Buscar usuários que optaram pelo BI diário
    const { data: users, error: usersErr } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, target_exams, target_exam, exam_date, daily_study_hours, recovery_mode")
      .eq("whatsapp_opt_out", false)
      .not("phone", "is", null)
      .neq("phone", "");

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users opted in", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    let queued = 0;

    // Get admin user for sender
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();
    const adminId = adminRole?.user_id || users[0].user_id;

    // Buscar snapshots e approval scores em lote
    const userIds = users.map((u: any) => u.user_id);

    const [{ data: allSnapshots }, { data: allApproval }, { data: allWeeklyGoals }] = await Promise.all([
      supabase.from("dashboard_snapshots").select("user_id, snapshot_json").in("user_id", userIds),
      supabase.from("approval_scores").select("user_id, score, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      supabase.from("weekly_goals").select("user_id, questions_target, questions_done, reviews_target, reviews_done, week_start").in("user_id", userIds).gte("week_start", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]),
    ]);

    const snapshotByUser: Record<string, any> = {};
    (allSnapshots || []).forEach((s: any) => { snapshotByUser[s.user_id] = s.snapshot_json; });

    const approvalByUser: Record<string, number> = {};
    (allApproval || []).forEach((a: any) => {
      if (!approvalByUser[a.user_id]) approvalByUser[a.user_id] = Math.min(100, Math.round(a.score));
    });

    const weeklyByUser: Record<string, any> = {};
    (allWeeklyGoals || []).forEach((w: any) => {
      if (!weeklyByUser[w.user_id]) weeklyByUser[w.user_id] = w;
    });

    for (const user of users) {
      try {
        // Check if already sent today
        const { data: alreadySent } = await supabase
          .from("whatsapp_message_log")
          .select("id")
          .eq("target_user_id", user.user_id)
          .eq("execution_mode", "daily_bi")
          .gte("sent_at", `${today}T00:00:00Z`)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          console.log(`User ${user.user_id} already received message today, skipping`);
          continue;
        }

        // 2. Coletar BI do dia
        const { data: attempts } = await supabase
          .from("practice_attempts")
          .select("correct")
          .eq("user_id", user.user_id)
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59`);

        const totalQ = attempts?.length || 0;
        const correctQ = attempts?.filter((a: any) => a.correct).length || 0;
        const accuracy = totalQ > 0 ? Math.min(100, Math.round((correctQ / totalQ) * 100)) : 0;

        // Gamification (XP, streak)
        const { data: gamif } = await supabase
          .from("user_gamification")
          .select("xp, streak_days, current_streak")
          .eq("user_id", user.user_id)
          .single();

        const xp = gamif?.xp || 0;
        const streak = gamif?.current_streak || gamif?.streak_days || 0;

        // Temas estudados hoje
        const { data: temas } = await supabase
          .from("temas_estudados")
          .select("tema")
          .eq("user_id", user.user_id)
          .eq("data_estudo", today)
          .limit(5);

        const temasHoje = temas?.map((t: any) => t.tema).join(", ") || "nenhum";

        // 3. Programação de amanhã - revisões pendentes
        const { data: revisoes } = await supabase
          .from("revisoes")
          .select("tema_id")
          .eq("user_id", user.user_id)
          .eq("data_revisao", tomorrow)
          .eq("status", "pendente")
          .limit(5);

        let temasAmanha = "nenhuma revisão agendada";
        if (revisoes && revisoes.length > 0) {
          const temaIds = revisoes.map((r: any) => r.tema_id);
          const { data: temasData } = await supabase
            .from("temas_estudados")
            .select("tema")
            .in("id", temaIds);
          temasAmanha = temasData?.map((t: any) => t.tema).join(", ") || "revisões pendentes";
        }

        // Temas fracos (error_bank não dominados)
        const { data: erros } = await supabase
          .from("error_bank")
          .select("tema")
          .eq("user_id", user.user_id)
          .eq("dominado", false)
          .order("vezes_errado", { ascending: false })
          .limit(3);

        const temasFracos = erros?.map((e: any) => e.tema).join(", ") || "nenhum identificado";

        // Proficiência — atividades do professor
        const { data: simResults } = await supabase
          .from("teacher_simulado_results")
          .select("status, score, total_questions")
          .eq("student_id", user.user_id);

        const { data: caseResults } = await supabase
          .from("teacher_clinical_case_results")
          .select("status, final_score, grade, student_got_diagnosis")
          .eq("student_id", user.user_id);

        const { data: assignResults } = await supabase
          .from("teacher_study_assignment_results")
          .select("status")
          .eq("student_id", user.user_id);

        let proficienciaInfo = "";

        if ((simResults && simResults.length > 0) || (caseResults && caseResults.length > 0) || (assignResults && assignResults.length > 0)) {
          const parts: string[] = [];

          if (simResults && simResults.length > 0) {
            const done = simResults.filter((r: any) => r.status === "completed");
            const pending = simResults.filter((r: any) => r.status === "pending").length;
            const avgScore = done.length > 0
              ? Math.min(100, Math.round(done.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / done.length))
              : 0;
            parts.push(`- Simulados: ${done.length} feito(s)${done.length > 0 ? ` (média ${avgScore}%)` : ""}, ${pending} pendente(s)`);
          }

          if (caseResults && caseResults.length > 0) {
            const done = caseResults.filter((r: any) => r.status === "completed");
            const pending = caseResults.filter((r: any) => r.status === "pending").length;
            const avgScore = done.length > 0
              ? Math.round(done.reduce((sum: number, r: any) => sum + (r.final_score || 0), 0) / done.length)
              : 0;
            const diagOk = done.filter((r: any) => r.student_got_diagnosis).length;
            parts.push(`- Casos clínicos: ${done.length} feito(s)${done.length > 0 ? ` (nota média ${avgScore}, diagnóstico correto ${diagOk}/${done.length})` : ""}, ${pending} pendente(s)`);
          }

          if (assignResults && assignResults.length > 0) {
            const done = assignResults.filter((r: any) => r.status === "completed").length;
            const pending = assignResults.filter((r: any) => r.status === "pending").length;
            parts.push(`- Temas de estudo: ${done} concluído(s), ${pending} pendente(s)`);
          }

          proficienciaInfo = `\nATIVIDADES DO PROFESSOR:\n${parts.join("\n")}`;
        }

        // === NOVOS DADOS DO SISTEMA ===

        // Bancas alvo
        const targetExams = (user as any).target_exams;
        const bancasAlvo = Array.isArray(targetExams) && targetExams.length > 0
          ? targetExams.join(", ").toUpperCase()
          : ((user as any).target_exam || "não definida").toUpperCase();

        // Data da prova e contagem regressiva
        const examDate = (user as any).exam_date;
        let contagemRegressiva = "";
        if (examDate) {
          const diasRestantes = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
          if (diasRestantes > 0) {
            contagemRegressiva = `${diasRestantes} dias para a prova`;
          } else if (diasRestantes === 0) {
            contagemRegressiva = "A PROVA É HOJE!";
          }
        }

        // Modo Recuperação Pesada
        const isRecoveryMode = (user as any).recovery_mode === true;

        // Índice de preparação (approval score)
        const approvalScore = approvalByUser[user.user_id];
        const approvalText = approvalScore !== undefined ? `${approvalScore}%` : "ainda não calculado";

        // Metas semanais
        const weekly = weeklyByUser[user.user_id];
        let metasText = "";
        if (weekly) {
          const qPct = weekly.questions_target > 0
            ? Math.min(100, Math.round((weekly.questions_done / weekly.questions_target) * 100))
            : 0;
          const rPct = weekly.reviews_target > 0
            ? Math.min(100, Math.round((weekly.reviews_done / weekly.reviews_target) * 100))
            : 0;
          metasText = `Questões: ${weekly.questions_done}/${weekly.questions_target} (${qPct}%) | Revisões: ${weekly.reviews_done}/${weekly.reviews_target} (${rPct}%)`;
        }

        // 4. Gerar mensagem via IA
        const nome = user.display_name?.split(" ")[0] || "Aluno";

        const prompt = `Gere uma mensagem WhatsApp curta e motivacional (máx 700 chars) em português brasileiro para o aluno ${nome} com este resumo do dia e programação de amanhã. Use emojis. Inclua TODOS os dados abaixo. Não invente dados. SEM markdown. SEM asteriscos.

REGRAS IMPORTANTES:
- NUNCA mostre percentuais acima de 100%. Valores são de 0% a 100%.
- NÃO invente dados ou métricas que não foram fornecidos.
- NÃO calcule "probabilidade de aprovação" — apenas relate os dados fornecidos.
- Se o aluno está em MODO RECUPERAÇÃO, incentive sem pressionar. Tom: acolhedor.

RESUMO DE HOJE:
- Questões respondidas: ${totalQ}
- Acurácia: ${accuracy}%
- Streak: ${streak} dias
- XP total: ${xp}
- Temas estudados: ${temasHoje}
${proficienciaInfo}

BANCAS ALVO: ${bancasAlvo}
${contagemRegressiva ? `CONTAGEM REGRESSIVA: ${contagemRegressiva}` : ""}
ÍNDICE DE PREPARAÇÃO: ${approvalText}
${metasText ? `METAS DA SEMANA: ${metasText}` : ""}
${isRecoveryMode ? "⚠️ MODO RECUPERAÇÃO PESADA ATIVO — o aluno está em recuperação progressiva. Não pressione, incentive cada pequeno avanço." : ""}

AMANHÃ:
- Revisões: ${temasAmanha}
- Áreas para focar: ${temasFracos}

A mensagem DEVE:
1. Mencionar a(s) banca(s) alvo pelo nome
2. Se houver contagem regressiva, mencionar os dias restantes
3. Mencionar o índice de preparação
4. Se houver metas semanais, dar feedback do progresso
5. Se modo recuperação ativo, tom acolhedor e celebrar qualquer progresso
6. No final, adicionar: "Responda SAIR para não receber mais."
7. Link do app: https://enazizi.com`;

        let messageText: string;
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        if (LOVABLE_API_KEY) {
          try {
            const aiResp = await fetch(LOVABLE_GATEWAY, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                  { role: "system", content: "Você gera mensagens WhatsApp motivacionais e informativas para alunos de medicina em preparação para residência. Tom: direto, encorajador, com emojis. Sem markdown. Sem asteriscos. Sempre mencione as bancas alvo e o progresso real do aluno." },
                  { role: "user", content: prompt },
                ],
                max_tokens: 1024,
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              messageText = aiData?.choices?.[0]?.message?.content ||
                buildFallbackMessage(nome, totalQ, accuracy, streak, temasAmanha, temasFracos, proficienciaInfo, bancasAlvo, contagemRegressiva, approvalText, metasText, isRecoveryMode);
            } else {
              console.warn(`AI returned ${aiResp.status}, using fallback`);
              messageText = buildFallbackMessage(nome, totalQ, accuracy, streak, temasAmanha, temasFracos, proficienciaInfo, bancasAlvo, contagemRegressiva, approvalText, metasText, isRecoveryMode);
            }
          } catch (aiErr) {
            console.error("AI fetch error:", aiErr);
            messageText = buildFallbackMessage(nome, totalQ, accuracy, streak, temasAmanha, temasFracos, proficienciaInfo, bancasAlvo, contagemRegressiva, approvalText, metasText, isRecoveryMode);
          }
        } else {
          messageText = buildFallbackMessage(nome, totalQ, accuracy, streak, temasAmanha, temasFracos, proficienciaInfo, bancasAlvo, contagemRegressiva, approvalText, metasText, isRecoveryMode);
        }

        // Fix AI sometimes splitting "enazizi" into "e nazizi"
        messageText = messageText.replace(/e\s+nazizi\.com/gi, "enazizi.com");

        // 5. Inserir na fila
        await supabase.from("whatsapp_message_log").insert({
          admin_user_id: adminId,
          target_user_id: user.user_id,
          message_text: messageText,
          delivery_status: "pending",
          execution_mode: "daily_bi",
        });

        queued++;
      } catch (userErr) {
        console.error(`Error processing user ${user.user_id}:`, userErr);
      }
    }

    // 6. Criar execução ativa para o agente local detectar
    if (queued > 0) {
      try {
        const { data: activeExecs } = await supabase
          .from("whatsapp_send_executions")
          .select("*")
          .in("status", ["running", "paused"])
          .eq("execution_date", today)
          .limit(1);

        let exec: any;
        let reused = false;

        if (activeExecs && activeExecs.length > 0) {
          exec = activeExecs[0];
          reused = true;
          if (exec.status !== "running") {
            await supabase
              .from("whatsapp_send_executions")
              .update({ status: "running" })
              .eq("id", exec.id);
          }
        } else {
          const { data: newExec, error: execErr } = await supabase
            .from("whatsapp_send_executions")
            .insert({
              admin_user_id: adminId,
              execution_date: today,
              mode: "desktop",
              status: "running",
              started_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (execErr) {
            console.error("Failed to create execution:", execErr);
          } else {
            exec = newExec;
          }
        }

        if (exec) {
          const { error: linkErr } = await supabase
            .from("whatsapp_message_log")
            .update({ execution_id: exec.id })
            .eq("delivery_status", "pending")
            .is("execution_id", null)
            .gte("created_at", `${today}T00:00:00Z`);

          if (linkErr) {
            console.error("Failed to link items to execution:", linkErr);
          }

          const { count } = await supabase
            .from("whatsapp_message_log")
            .select("id", { count: "exact", head: true })
            .eq("execution_id", exec.id);

          await supabase
            .from("whatsapp_send_executions")
            .update({ total_items: count || queued })
            .eq("id", exec.id);

          await supabase.from("whatsapp_execution_logs").insert({
            execution_id: exec.id,
            action: reused ? "execution_reused" : "execution_started",
            status: "success",
            message: reused
              ? `BI diário: ${queued} novos itens vinculados`
              : `BI diário: execução criada com ${queued} itens`,
          });

          await supabase.from("admin_audit_log").insert({
            admin_user_id: adminId,
            action: "whatsapp_daily_bi_execution",
            details: { execution_id: exec.id, queued, date: today, reused },
          });

          console.log(`${reused ? "Reused" : "Created"} execution ${exec.id} with ${queued} items`);
        }
      } catch (execCreateErr) {
        console.error("Error creating execution:", execCreateErr);
      }
    }

    return new Response(JSON.stringify({ message: "Daily BI queued", count: queued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallbackMessage(
  nome: string, totalQ: number, accuracy: number, streak: number,
  temasAmanha: string, temasFracos: string, proficienciaInfo: string,
  bancasAlvo: string, contagemRegressiva: string, approvalText: string,
  metasText: string, isRecoveryMode: boolean
): string {
  const profBlock = proficienciaInfo ? `\n📋 Proficiência:${proficienciaInfo}\n` : "";
  const bancaLine = `🎯 Bancas: ${bancasAlvo}`;
  const countdownLine = contagemRegressiva ? `⏳ ${contagemRegressiva}` : "";
  const approvalLine = `📊 Índice: ${approvalText}`;
  const metasLine = metasText ? `📈 Metas: ${metasText}` : "";
  const recoveryLine = isRecoveryMode ? "🔄 Modo Recuperação ativo — cada passo conta!" : "";

  const lines = [
    `📊 Resumo de hoje, ${nome}:`,
    `${totalQ} questões | ${accuracy}% acurácia | 🔥 ${streak} dias`,
    bancaLine,
    countdownLine,
    approvalLine,
    metasLine,
    recoveryLine,
    profBlock,
    `📋 Amanhã:`,
    `Revisão: ${temasAmanha}`,
    `Foco: ${temasFracos}`,
    "",
    "https://enazizi.com",
    "Responda SAIR para não receber mais.",
  ].filter(Boolean);

  return lines.join("\n");
}