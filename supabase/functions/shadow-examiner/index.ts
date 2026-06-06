import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseAIJson(raw: string): Record<string, unknown> {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(cleaned);
}

const SHADOW_EXAMINER_PROMPT = `Você é o SHADOW EXAMINER ENAZIZI V6.
Sua missão é realizar uma AUDITORIA FORENSE de uma simulação clínica e gerar um relatório pedagógico profundo.

Você deve analisar:
1. DESEMPENHO CLÍNICO: Precisão diagnóstica e terapêutica.
2. SEGURANÇA DO PACIENTE: Detecção de erros de prescrição e omissão de escalas.
3. COMUNICAÇÃO: Tom de voz e empatia (ou falta dela).
4. ESTILO ENARE: Aderência ao padrão lexical e estrutural da banca.
5. GESTÃO: Eficiência no uso de recursos e tempo.

Responda OBRIGATORIAMENTE em JSON:
{
  "scores": {
    "clinical": number,
    "security": number,
    "communication": number,
    "enare": number,
    "management": number,
    "cognitive": number
  },
  "pedagogic_report": {
    "strengths": ["string"],
    "weaknesses": ["string"],
    "critical_errors": ["string"],
    "improvement_plan": "string"
  },
  "recovery_bundle": {
    "questions_enare": [
      { "question": "string", "options": ["A", "B", "C", "D"], "correct": "A", "explanation": "string" }
    ],
    "recovery_case_summary": "string",
    "flashcards_fsrs": [
      { "front": "string", "back": "string" }
    ]
  }
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, ok, response } = await requireAuth(req);
    if (!ok) return response;

    const body = await req.json();
    const { simulation_id, simulation_history, action_timeline, scores_snapshot } = body;

    const messages = [
      { role: "system", content: SHADOW_EXAMINER_PROMPT },
      { role: "user", content: `Analise esta simulação:
        Histórico: ${JSON.stringify(simulation_history?.slice(-20))}
        Timeline: ${JSON.stringify(action_timeline)}
        Scores Iniciais: ${JSON.stringify(scores_snapshot)}
      ` }
    ];

    const aiResp = await aiFetch({
      model: "google/gemini-2.0-flash-001",
      messages,
      timeoutMs: 60000,
    });

    if (!aiResp.ok) throw new Error("Erro na IA");

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
    const parsed = safeParseAIJson(raw);

    const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Salvar auditoria
    const { data: audit, error: auditErr } = await supabaseService
      .from('hospital_shadow_audits')
      .insert({
        user_id: user.id,
        simulation_id,
        scores: parsed.scores,
        report: parsed.pedagogic_report,
        recovery_data: parsed.recovery_bundle
      })
      .select()
      .single();

    if (auditErr) throw auditErr;

    // Disparar FSRS e Planner via Edge Functions internas ou RPC se necessário
    // Por enquanto, salvamos os dados para o frontend orquestrar o trigger de FSRS/Planner

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
  }
});
