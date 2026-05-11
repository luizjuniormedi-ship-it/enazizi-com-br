/**
 * @legacy-write
 * @deprecated-flow — APOSENTADA na sprint final do Planner.
 *
 * Esta edge function escreve em study_plans (shape semanal weeklySchedule).
 * Não é mais chamada pelo onboarding nem por nenhum fluxo principal do ENAZIZI.
 *
 * Fonte viva oficial do Planner: daily_plans + daily_plan_tasks (diário, gerado por planner-orchestrator-v1).
 * Mantida apenas para retrocompatibilidade da UX semanal de StudyPlan/StudyPlanContent (ambos isolados).
 *
 * NÃO REATIVAR sem redesign completo do gerador para o shape diário.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito\s+(penal|civil|constitucional|tributário)|jur[ií]dic|processo\s+penal|stf|stj|delegad[oa]|advogad[oa]|pol[ií]cia\s+federal|c[oó]digo\s+penal|a[cç][aã]o\s+penal|engenharia\s+(civil|elétrica|mecânica)|contabilidade|ciências\s+contábeis)/i;

// For edital/cronograma: only reject clearly non-medical content, accept everything else
// Medical subjects often have generic names (e.g., "Atenção Básica", "Saúde da Família", "Urgência")
const isNonMedicalContent = (text: string) => NON_MEDICAL_CONTENT_REGEX.test(text);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[GENERATE_STUDY_PLAN] Request received");
    
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;
    const authHeader = req.headers.get("Authorization")!;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { examDate, hoursPerDay, daysPerWeek, editalText, currentPlanId, targetExams, targetExam } = body;
    console.log("[GENERATE_STUDY_PLAN] Payload validated:", { userId, hasEdital: !!editalText });

    if (!examDate || !hoursPerDay || !daysPerWeek) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes: data da prova, horas ou dias." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const editalPreview = String(editalText || "").slice(0, 5000); // Reduced context for safer processing
    
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

    const prompt = `Você é um especialista em planejamento de estudos médicos.
Gere um cronograma semanal de estudos em JSON PURO.
- Data da prova: ${examDate} (${daysUntilExam} dias)
- Horas/dia: ${hoursPerDay}h
- Dias/semana: ${daysPerWeek} dias
Conteúdo Base: ${editalPreview || "Temas padrão de residência médica"}
${bancaBlock}

Regras:
1. Extraia os temas principais e subtópicos.
2. Cada tema deve ter: 1 estudo teórico, 1 bloco de questões e revisões D1, D7, D30.
3. Respeite o limite de ${hoursPerDay}h/dia.

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

    console.log("[GENERATE_STUDY_PLAN] AI request starting...");
    const startMs = Date.now();
    let aiResp: Response | null = null;
    try {
      aiResp = await aiFetch({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        timeoutMs: 45000,
        maxRetries: 0, // Single attempt - rely on fallback if it fails
      });
    } catch (aiErr) {
      console.warn("[GENERATE_STUDY_PLAN] AI call failed, using fallback:", aiErr);
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

    const planData = {
      user_id: userId,
      plan_json: {
        ...planJson,
        config: { examDate, hoursPerDay, daysPerWeek, hasEdital: !!editalText },
        generatedAt: new Date().toISOString(),
      },
    };

    let result;
    if (currentPlanId) {
      console.log(`[GENERATE_STUDY_PLAN] Updating existing plan: ${currentPlanId}`);
      const { data, error } = await supabaseAdmin.from("study_plans").update({ plan_json: planData.plan_json }).eq("id", currentPlanId).eq("user_id", userId).select().single();
      if (error) throw error;
      result = data;
    } else {
      console.log("[GENERATE_STUDY_PLAN] Creating new plan");
      const { data, error } = await supabaseAdmin.from("study_plans").insert(planData).select().single();
      if (error) throw error;
      result = data;
    }

    console.log("[GENERATE_STUDY_PLAN] Completed successfully", { 
      plan_created: !!result, 
      tasks_count: planJson.weeklySchedule?.[0]?.tasks?.length || 0,
      ai_fallback: !aiResp?.ok
    });
    return new Response(JSON.stringify({ success: true, plan: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[GENERATE_STUDY_PLAN] Global error:", e);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e instanceof Error ? e.message : "Erro interno na geração do plano",
      step: "global_catch"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});