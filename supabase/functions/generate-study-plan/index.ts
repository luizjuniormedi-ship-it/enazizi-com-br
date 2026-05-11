/**
 * @legacy-write
 * @deprecated-flow — APOSENTADA na sprint final do Planner.
 *
 * Esta edge function escreve em study_plans (shape semanal weeklySchedule).
 * Refatorada para ser ASSÍNCRONA para evitar timeouts de 150s.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito\s+(penal|civil|constitucional|tributário)|jur[ií]dic|processo\s+penal|stf|stj|delegad[oa]|advogad[oa]|pol[ií]cia\s+federal|c[oó]digo\s+penal|a[cç][aã]o\s+penal|engenharia\s+(civil|elétrica|mecânica)|contabilidade|ciências\s+contábeis)/i;

async function updateStatus(supabaseAdmin: any, planId: string, status: string, progress: number, step?: string, errorMsg?: string) {
  const update: any = { status, progress, updated_at: new Date().toISOString() };
  if (step) update.current_step = step;
  if (errorMsg) update.error_message = errorMsg;
  await supabaseAdmin.from("study_plans").update(update).eq("id", planId);
}

async function processInBackground(
  planId: string,
  userId: string,
  payload: any,
  supabaseAdmin: any,
  userToken: string
) {
  console.log(`[GENERATE_STUDY_PLAN] Background processing for ${planId}...`);

  const { examDate, hoursPerDay, daysPerWeek, editalText, targetExams, targetExam, coverageStats } = payload;
  
  try {
    // 1. Initial Step
    await updateStatus(supabaseAdmin, planId, "processing", 10, "Analisando edital e preparando IA...");

    const editalPreview = String(editalText || "").slice(0, 10000);
    
    // Load target_exam if not provided
    let bancaKeys: string[] = targetExams || (targetExam ? [targetExam] : []);
    if (bancaKeys.length === 0) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("target_exams, target_exam").eq("user_id", userId).maybeSingle();
      if (prof?.target_exams?.length > 0) bancaKeys = prof.target_exams;
      else if (prof?.target_exam) bancaKeys = [prof.target_exam];
    }
    const bancaProfile = bancaKeys.length > 0 ? getBancaProfile(bancaKeys[0]) : getBancaProfile(null);
    const bancaBlock = buildBancaBlock(bancaProfile);

    const daysUntilExam = Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // 2. AI Prompt Construction
    await updateStatus(supabaseAdmin, planId, "processing", 30, "Construindo cronograma personalizado...");

    const prompt = `Você é um especialista em planejamento de estudos médicos.
Gere um cronograma semanal de estudos em JSON PURO.
- Data da prova: ${examDate} (${daysUntilExam} dias)
- Horas/dia: ${hoursPerDay}h
- Dias/semana: ${daysPerWeek} dias
Conteúdo Base (Tópicos do Edital): 
${editalText || "Temas padrão de residência médica"}

${bancaBlock}

Regras:
1. Use TODOS os tópicos fornecidos no "Conteúdo Base" para montar o cronograma.
2. Não ignore nenhum tema importante. Se houver muitos temas, distribua-os ao longo das semanas.
3. Cada tema deve ter: 1 estudo teórico, 1 bloco de questões e revisões D1, D7, D30.
4. Respeite o limite de ${hoursPerDay}h/dia.

Formato JSON:
{
  "detectedSpecialty": "...",
  "subjects": ["Tema 1", "Tema 2"],
  "topicMap": [{"topic": "Tema 1", "subtopics": ["Sub 1", "Sub 2"]}],
  "weeklySchedule": [
    {
      "day": "Seg",
      "week": 1,
      "tasks": [{"time": "08:00", "subject": "Tema 1", "duration": "2h", "type": "estudo", "details": "..."}]
    }
  ],
  "tips": "..."
}`;

    // 3. AI Execution
    console.log("[GENERATE_STUDY_PLAN] AI request starting...");
    const startMs = Date.now();
    let aiResp: Response | null = null;
    try {
      aiResp = await aiFetch({
        model: "google/gemini-2.0-flash-lite", // Use latest fast model
        messages: [{ role: "user", content: prompt }],
        timeoutMs: 60000, // 60s for AI
        maxRetries: 1,
      });
    } catch (aiErr) {
      console.warn("[GENERATE_STUDY_PLAN] AI call failed:", aiErr);
    }
    const elapsed = Date.now() - startMs;
    console.log(`[GENERATE_STUDY_PLAN] AI elapsed: ${elapsed}ms, ok: ${aiResp?.ok}`);

    let planJson;
    if (aiResp?.ok) {
      const aiData = await aiResp.json();
      const content = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
      try {
        planJson = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) planJson = JSON.parse(match[0]);
      }
    }

    // Fallback if AI fails or returns invalid JSON
    if (!planJson) {
      console.warn("[GENERATE_STUDY_PLAN] AI failed or returned invalid JSON. Using fallback.");
      const fallbackTopics = editalPreview ? editalPreview.split('\n').slice(0, 5).filter(t => t.trim().length > 3) : ["Clínica Médica", "Pediatria", "Cirurgia", "Ginecologia", "Preventiva"];
      planJson = {
        detectedSpecialty: "Medicina Geral",
        subjects: fallbackTopics,
        topicMap: fallbackTopics.map(t => ({ topic: t, subtopics: ["Revisão geral"] })),
        weeklySchedule: [
          {
            day: "Seg", week: 1,
            tasks: fallbackTopics.map((t, i) => ({ time: `${8+i}:00`, subject: t, duration: "1h", type: "estudo", details: "Estudo base" }))
          }
        ],
        tips: "Cronograma criado em modo seguro devido a instabilidade na IA. Você pode refinar o conteúdo depois."
      };
    }

    // 4. Saving Result
    await updateStatus(supabaseAdmin, planId, "processing", 80, "Salvando tarefas e finalizando...");

    const updatedPlanJson = {
      ...planJson,
      config: { examDate, hoursPerDay, daysPerWeek, hasEdital: !!editalText },
      generatedAt: new Date().toISOString(),
      coverageStats: coverageStats || null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("study_plans")
      .update({ 
        plan_json: updatedPlanJson,
        status: "completed",
        progress: 100,
        current_step: "Finalizado",
        error_message: null
      })
      .eq("id", planId);

    if (updateError) throw updateError;

    // 5. Trigger Daily Plan generation so it shows up in dashboard mission
    console.log("[GENERATE_STUDY_PLAN] Triggering daily-plan generation...");
    try {
      const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-daily-plan`;
      await fetch(functionUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${userToken}` 
        },
        body: JSON.stringify({ force: true })
      });
    } catch (triggerErr) {
      console.warn("[GENERATE_STUDY_PLAN] Failed to trigger daily plan:", triggerErr);
    }

    console.log("[GENERATE_STUDY_PLAN] Completed successfully", { 
      planId, 
      tasks_count: planJson.weeklySchedule?.[0]?.tasks?.length || 0,
      ai_fallback: !aiResp?.ok
    });



  } catch (e: any) {
    console.error("[GENERATE_STUDY_PLAN] Background error:", e);
    await updateStatus(supabaseAdmin, planId, "error", 0, "Erro fatal", e.message || "Erro desconhecido");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[GENERATE_STUDY_PLAN] Request received");
    
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { examDate, hoursPerDay, daysPerWeek, currentPlanId } = body;

    if (!examDate || !hoursPerDay || !daysPerWeek) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes: data da prova, horas ou dias." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let planId = currentPlanId;
    
    // 1. Get or Create the Plan Record
    if (planId) {
      const { error } = await supabaseAdmin.from("study_plans").update({
        status: "processing",
        progress: 0,
        current_step: "Iniciando...",
        error_message: null
      }).eq("id", planId).eq("user_id", userId);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseAdmin.from("study_plans").insert({
        user_id: userId,
        status: "processing",
        progress: 0,
        current_step: "Iniciando...",
        plan_json: { status: "initializing" }
      }).select("id").single();
      if (error) throw error;
      planId = data.id;
    }

    // 2. Start Background Process
    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground(planId, userId, body, supabaseAdmin, auth.token));


    return new Response(JSON.stringify({ 
      success: true, 
      message: "Geração iniciada em segundo plano", 
      planId 
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[GENERATE_STUDY_PLAN] Sync error:", e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e instanceof Error ? e.message : "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});