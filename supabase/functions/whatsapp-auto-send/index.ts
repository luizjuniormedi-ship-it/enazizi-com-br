import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10);
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  const respond = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Check if already ran today
    const { data: existing } = await supabase
      .from("whatsapp_send_executions")
      .select("id")
      .eq("execution_date", today)
      .eq("mode", "auto")
      .limit(1);

    if (existing && existing.length > 0) {
      log("Já executou hoje, pulando.");
      return respond({ skipped: true, reason: "already_ran_today", logs });
    }

    // Get admin user
    const { data: adminRoles } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin").limit(1);
    if (!adminRoles?.length) return respond({ error: "No admin", logs }, 500);
    const adminUserId = adminRoles[0].user_id;

    // Get students with phone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, target_exams, target_exam, exam_date, recovery_mode")
      .not("phone", "is", null)
      .neq("phone", "")
      .eq("status", "active")
      .eq("is_blocked", false)
      .eq("whatsapp_opt_out", false);

    if (!profiles?.length) {
      log("Nenhum aluno com telefone.");
      return respond({ skipped: true, reason: "no_students", logs });
    }

    const userIds = profiles.map((p: any) => p.user_id);

    // Already sent today
    const { data: todayLogs } = await supabase
      .from("whatsapp_message_log")
      .select("target_user_id")
      .gte("sent_at", `${today}T00:00:00Z`)
      .in("target_user_id", userIds);

    const sentToday = new Set((todayLogs || []).map((l: any) => l.target_user_id));

    // Recent messages for anti-repetition
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recentLogs } = await supabase
      .from("whatsapp_message_log")
      .select("target_user_id, message_text")
      .gte("sent_at", sevenDaysAgo)
      .in("target_user_id", userIds)
      .order("sent_at", { ascending: false })
      .limit(500);

    const recentByUser: Record<string, string[]> = {};
    (recentLogs || []).forEach((l: any) => {
      if (!recentByUser[l.target_user_id]) recentByUser[l.target_user_id] = [];
      if (recentByUser[l.target_user_id].length < 5) recentByUser[l.target_user_id].push(l.message_text);
    });

    // Dados em lote
    const [{ data: allRevisoes }, { data: allGamification }, { data: allApproval }, { data: allWeeklyGoals }] = await Promise.all([
      supabase.from("revisoes")
        .select("user_id, tipo_revisao, risco_esquecimento, tema_id, temas_estudados(tema, especialidade)")
        .eq("status", "pendente").lte("data_revisao", today).in("user_id", userIds),
      supabase.from("user_gamification")
        .select("user_id, current_streak, xp, level").in("user_id", userIds),
      supabase.from("approval_scores")
        .select("user_id, score, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      supabase.from("weekly_goals")
        .select("user_id, questions_target, questions_done, reviews_target, reviews_done, week_start")
        .in("user_id", userIds).gte("week_start", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]),
    ]);

    const revisoesByUser: Record<string, any[]> = {};
    (allRevisoes || []).forEach((r: any) => {
      if (!revisoesByUser[r.user_id]) revisoesByUser[r.user_id] = [];
      revisoesByUser[r.user_id].push(r);
    });

    const gamByUser: Record<string, any> = {};
    (allGamification || []).forEach((g: any) => { gamByUser[g.user_id] = g; });

    const approvalByUser: Record<string, number> = {};
    (allApproval || []).forEach((a: any) => {
      if (!approvalByUser[a.user_id]) approvalByUser[a.user_id] = Math.min(100, Math.round(a.score));
    });

    const weeklyByUser: Record<string, any> = {};
    (allWeeklyGoals || []).forEach((w: any) => {
      if (!weeklyByUser[w.user_id]) weeklyByUser[w.user_id] = w;
    });

    // Filter pending students
    const pendingProfiles = profiles.filter((p: any) => !sentToday.has(p.user_id));
    if (!pendingProfiles.length) {
      log("Todos já receberam hoje.");
      return respond({ skipped: true, reason: "all_sent", logs });
    }

    log(`${pendingProfiles.length} alunos pendentes, gerando mensagens...`);

    // Generate messages
    const messageLogs: any[] = [];

    for (let i = 0; i < pendingProfiles.length; i += 5) {
      const batch = pendingProfiles.slice(i, i + 5);
      const promises = batch.map(async (profile: any) => {
        const revisoes = revisoesByUser[profile.user_id] || [];
        const gam = gamByUser[profile.user_id] || { current_streak: 0, xp: 0, level: 1 };
        const urgentes = revisoes.filter((r: any) => r.risco_esquecimento === "alto" || r.risco_esquecimento === "critico");
        const previousMessages = recentByUser[profile.user_id] || [];

        // Novos dados
        const targetExams = profile.target_exams;
        const bancasAlvo = Array.isArray(targetExams) && targetExams.length > 0
          ? targetExams.join(", ").toUpperCase()
          : (profile.target_exam || "não definida").toUpperCase();

        const examDate = profile.exam_date;
        let contagemRegressiva = "";
        if (examDate) {
          const diasRestantes = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
          if (diasRestantes > 0) contagemRegressiva = `${diasRestantes} dias para a prova`;
          else if (diasRestantes === 0) contagemRegressiva = "A PROVA É HOJE!";
        }

        const isRecoveryMode = profile.recovery_mode === true;
        const approvalScore = approvalByUser[profile.user_id];
        const approvalText = approvalScore !== undefined ? `${approvalScore}%` : "não calculado";

        const weekly = weeklyByUser[profile.user_id];
        let metasText = "";
        if (weekly) {
          const qPct = weekly.questions_target > 0 ? Math.min(100, Math.round((weekly.questions_done / weekly.questions_target) * 100)) : 0;
          const rPct = weekly.reviews_target > 0 ? Math.min(100, Math.round((weekly.reviews_done / weekly.reviews_target) * 100)) : 0;
          metasText = `Questões: ${weekly.questions_done}/${weekly.questions_target} (${qPct}%) | Revisões: ${weekly.reviews_done}/${weekly.reviews_target} (${rPct}%)`;
        }

        const revisoesText = revisoes.length > 0
          ? revisoes.map((r: any) => {
              const tema = r.temas_estudados?.tema || "Tema";
              const esp = r.temas_estudados?.especialidade || "";
              const risco = r.risco_esquecimento === "critico" ? "🔴" : r.risco_esquecimento === "alto" ? "🟠" : "🟡";
              return `- ${tema} (${esp}) ${risco}`;
            }).join("\n")
          : "Nenhuma revisão pendente.";

        const streak = gam.current_streak || 0;
        let mood = "meh";
        if (streak >= 5 && revisoes.length <= 3) mood = "champion";
        else if (streak >= 2) mood = "good";
        else if (streak === 0) mood = "slacking";
        if (revisoes.length > 5 && urgentes.length > 2) mood = "danger";
        if (isRecoveryMode) mood = "recovery";

        const moodInstructions: Record<string, string> = {
          champion: "Elogie o streak com humor médico. Tom: orgulhoso e engraçado.",
          good: "Tom: encorajador e positivo com humor.",
          meh: "Tom: provocativo mas amigável.",
          slacking: "Streak zerou! Tom: bronca divertida mas firme.",
          danger: "URGENTE! Muitas revisões atrasadas. Tom: alarmante com humor.",
          recovery: "MODO RECUPERAÇÃO PESADA. Tom: acolhedor, celebre cada pequeno avanço. NÃO pressione.",
        };

        const antiRepBlock = previousMessages.length > 0
          ? `\n🚫 NÃO REPITA:\n${previousMessages.map((m, i) => `[${i + 1}] "${m.substring(0, 120)}"`).join("\n")}\n`
          : "";

        const prompt = `Gere mensagem WhatsApp curta e motivacional (máx 600 chars) para aluno de medicina.
Emojis com moderação. Direto. SEM markdown. SEM asteriscos.

SEED: ${Math.random().toString(36).slice(2, 10)}
${antiRepBlock}
TOM: ${moodInstructions[mood]}
Nome: ${profile.display_name || "Aluno"} | Streak: ${streak} | Nível: ${gam.level}
Bancas alvo: ${bancasAlvo}
${contagemRegressiva ? `Contagem regressiva: ${contagemRegressiva}` : ""}
Índice de preparação: ${approvalText}
${metasText ? `Metas da semana: ${metasText}` : ""}
${isRecoveryMode ? "⚠️ MODO RECUPERAÇÃO PESADA ATIVO" : ""}
Revisões: ${revisoes.length} (${urgentes.length} urgentes)
${revisoesText}

Link: https://enazizi.com

Comece com saudação pelo nome. Inclua piada médica. Mencione bancas alvo e revisões.
${contagemRegressiva ? "Mencione os dias restantes para a prova." : ""}
${isRecoveryMode ? "Celebre qualquer progresso, não pressione." : ""}
A ÚLTIMA LINHA da mensagem DEVE ser exatamente: "Responda SAIR para não receber mais."`;

        let message = "";
        try {
          if (LOVABLE_API_KEY) {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "openai/gpt-5-mini-mini",
                messages: [
                  { role: "system", content: "Gere mensagens WhatsApp únicas e engraçadas para alunos de medicina preparando para residência. Sempre mencione bancas alvo e dados reais. Sem markdown. Sem asteriscos." },
                  { role: "user", content: prompt },
                ],
                max_tokens: 512,
                temperature: 0.95,
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              message = aiData.choices?.[0]?.message?.content?.trim() || "";
            }
          }
        } catch { /* fallback */ }

        if (!message) {
          const firstName = (profile.display_name || "Aluno").split(" ")[0];
          message = `Olá ${firstName}! 📚 Você tem ${revisoes.length} revisão(ões) pendente(s) hoje. 🎯 ${bancasAlvo}. Bons estudos! 💪\nhttps://enazizi.com\nResponda SAIR para não receber mais.`;
        }

        message = message.replace(/e\s+nazizi\.com/gi, "enazizi.com");

        return {
          admin_user_id: adminUserId,
          target_user_id: profile.user_id,
          message_text: message,
          delivery_status: "pending",
          execution_mode: "auto",
        };
      });

      const results = await Promise.all(promises);
      messageLogs.push(...results);
    }

    // Insert message logs
    const { error: insertErr } = await supabase.from("whatsapp_message_log").insert(messageLogs);
    if (insertErr) {
      log(`Erro inserindo logs: ${insertErr.message}`);
      return respond({ error: insertErr.message, logs }, 500);
    }

    // Create execution
    const { data: exec, error: execErr } = await supabase
      .from("whatsapp_send_executions")
      .insert({
        admin_user_id: adminUserId,
        execution_date: today,
        mode: "auto",
        status: "running",
        started_at: new Date().toISOString(),
        total_items: messageLogs.length,
      })
      .select()
      .single();

    if (execErr) return respond({ error: execErr.message, logs }, 500);

    // Link items to execution
    await supabase
      .from("whatsapp_message_log")
      .update({ execution_id: exec.id })
      .eq("delivery_status", "pending")
      .eq("execution_mode", "auto")
      .is("execution_id", null)
      .gte("created_at", today + "T00:00:00Z");

    // Audit log
    await supabase.from("whatsapp_execution_logs").insert({
      execution_id: exec.id,
      action: "auto_execution_started",
      status: "success",
      message: `Execução automática: ${messageLogs.length} itens`,
    });

    await supabase.from("admin_audit_log").insert({
      admin_user_id: adminUserId,
      action: "whatsapp_auto_execution",
      details: { execution_id: exec.id, total_items: messageLogs.length },
    });

    log(`✅ Execução auto criada: ${exec.id} (${messageLogs.length} itens)`);
    return respond({ success: true, execution_id: exec.id, total_items: messageLogs.length, logs });

  } catch (e) {
    log(`Erro: ${e.message}`);
    return respond({ error: e.message, logs }, 500);
  }
});