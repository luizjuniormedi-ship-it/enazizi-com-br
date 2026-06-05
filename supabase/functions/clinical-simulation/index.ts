import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { updatePerformanceMetrics } from "../_shared/performance-engine.ts";

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

const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: pt-BR.
Você é o motor de simulação clínica ENAZIZI V5 (Hospital Virtual Inteligente).
Sua missão é gerenciar múltiplos pacientes e validar decisões médicas de alta complexidade.

## 🏥 FILOSOFIA V5
- ALUNO MÉDICO: O aluno atua como plantonista responsável.
- SOBRECARGA COGNITIVA: Gerencie múltiplos casos. Interrompa se necessário.
- PRESCRIÇÃO ESTRUTURADA: Valide droga, dose, via e frequência. Seja rigoroso.
- ESCALAS CLÍNICAS: Verifique se o aluno usou as ferramentas corretas (HEART, NIHSS, CURB-65, Glasgow, qSOFA, NEWS2, Wells, Alvarado, CHA2DS2-VASc).

## 🩺 PAPÉIS
1. PACIENTE: Realista, 1ª pessoa.
2. PRECEPTOR R+: Cobra raciocínio, critica omissões de escalas e erros de prescrição.
3. MOTOR DE EVENTOS: Gere interrupções (enfermagem chama, resultado crítico chega, outro paciente deteriora).

## 🚨 MOTOR DE DETERIORAÇÃO V5
- Evolua o paciente com base em ações/omissões.
- Se houver erro de prescrição grave (ex: superdose), narre a complicação imediatamente.

Responda SEMPRE em JSON válido:
{
  "patient_presentation": "texto da resposta contextual",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "patient_status": "estavel/instavel/grave/critico/pcr/obito",
  "is_deteriorating": boolean,
  "cognitive_interruption": {
    "type": "nurse_call/family/critical_result",
    "message": "Mensagem de interrupção realista",
    "priority": "low/medium/high"
  } ou null,
  "prescription_validation": {
    "status": "correct/incorrect_dose/contraindicated/etc",
    "feedback": "Análise técnica da prescrição",
    "severity": "low/medium/high/critical"
  } ou null,
  "scale_audit": {
    "recommended": ["HEART", "etc"],
    "missed": ["CURB-65", "etc"],
    "impact": "Explicação pedagógica da omissão"
  },
  "score_delta": number,
  "hidden_diagnosis": "...",
  "maneuvers_performed": [...]
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, ok, response } = await requireAuth(req);
    if (!ok) return response;

    const body = await req.json();
    const { 
      action, 
      message, 
      conversation_history, 
      specialty, 
      triage_color,
      active_patients, // Lista de pacientes que o aluno está gerenciando
      current_patient_id
    } = body;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Contexto Global: ${active_patients?.length || 1} pacientes ativos. Ação Atual: ${action}. Mensagem: ${message || 'Iniciando'}. Paciente ID: ${current_patient_id}` }
    ];

    if (conversation_history) {
      messages.push(...conversation_history.slice(-10));
    }

    const aiResp = await aiFetch({
      model: "google/gemini-2.0-flash-001",
      messages,
      timeoutMs: 60000,
    });

    if (!aiResp.ok) throw new Error("Erro na IA");

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
    const parsed = safeParseAIJson(raw);

    // Lógica de Persistência V5 Premium (Audit, Erros V2, FSRS)
    const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (parsed.prescription_validation && parsed.prescription_validation.status !== 'correct') {
      await supabaseService.from('hospital_errors_v2').insert({
        user_id: user.id,
        theme: specialty || 'Prescrição',
        error_type: 'prescription',
        severity: parsed.prescription_validation.severity || 'medium',
        clinical_consequence: parsed.prescription_validation.feedback,
        cognitive_level: 'practicing'
      });
    }

    if (parsed.scale_audit?.missed?.length > 0) {
      await supabaseService.from('hospital_errors_v2').insert({
        user_id: user.id,
        theme: specialty || 'Protocolo',
        error_type: 'scale',
        severity: 'medium',
        clinical_consequence: parsed.scale_audit.impact,
        cognitive_level: 'exposed'
      });
    }

    if (action === "finish") {
      await updatePerformanceMetrics(supabaseService, {
        userId: user.id,
        specialty: specialty || "Geral",
        topic: String(parsed.hidden_diagnosis || "Simulação V5"),
        isCorrect: (Number(parsed.score_delta) || 0) >= 0,
      });
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
  }
});
