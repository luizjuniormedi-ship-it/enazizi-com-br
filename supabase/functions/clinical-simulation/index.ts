import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { updatePerformanceMetrics } from "../_shared/performance-engine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseAIJson(raw: string, _action: string): Record<string, unknown> {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  cleaned = cleaned.replace(/:\s*(true|false)\s*\([^)]*\)/gi, ": $1");
  cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")\s*\([^)]*\)/g, "$1");
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  cleaned = cleaned.replace(/:\s*NaN\b/g, ": 0");
  cleaned = cleaned.replace(/:\s*undefined\b/g, ": null");
  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR).
Você é o motor de simulação clínica ENAZIZI V4 (Modo Plantão). Sua missão é transformar o atendimento em um ambiente imersivo de raciocínio clínico para emergência, internato, OSCE e residência médica.

## 🏥 FILOSOFIA MODO PLANTÃO V4
- O aluno atua como médico plantonista responsável.
- O aluno não recebe questões prontas. Ele deve conduzir TODO o atendimento.
- Início: Identificação, Queixa Principal e Triagem (Sinais Vitais iniciais).
- Progressão: O sistema é REATIVO. Você só responde ao que for solicitado.

## 🩺 SEU PAPEL TRIPLO
1. PACIENTE: Respostas realistas em 1ª pessoa. Revele detalhes de anamnese, histórico e medicamentos apenas se perguntado.
2. NARRADOR CLÍNICO: Descreva achados de exame físico e resultados de exames com alta precisão técnica.
3. PRECEPTOR R+ (Residente Sênior): Pressione o raciocínio, desafie condutas e avalie a segurança.

## 📋 ETAPAS DO ATENDIMENTO (V4)
1. ANAMNESE: Perguntas livres ou sugeridas. IA responde dinamicamente.
2. EXAME FÍSICO: Aluno escolhe o sistema (pulmonar, cardíaco, abdome, neurológico, etc). IA fornece achados coerentes.
3. HIPÓTESES DIAGNÓSTICAS: Solicite ao aluno que liste suas hipóteses antes de liberar exames complexos.
4. EXAMES COMPLEMENTARES: Laboratoriais (Hemograma, PCR, Gaso, Troponina, etc) e Imagem (RX, USG, TC, RM, ECG). Gere resultados realistas com referências.
5. DIAGNÓSTICO E CONDUTA: O aluno deve fechar o diagnóstico e definir conduta (Tratamento, Prescrição, Destino).

## 🚨 MOTOR DE DETERIORAÇÃO CLÍNICA
O estado do paciente deve evoluir com base nas ações (ou omissões) do aluno:
- Estável -> Instável -> Grave -> Crítico -> PCR.
- Se o aluno ignorar sinais de choque ou insuficiência respiratória, narre a deterioração IMEDIATAMENTE.
- Se o aluno tomar a conduta correta (ex: volume no choque, O2 na hipóxia), narre a melhora.

## ⚖️ SISTEMA DE AVALIAÇÃO (FINAL)
Ao receber action="finish", avalie:
- RACIOCÍNIO CLÍNICO: Hipóteses coerentes? Priorização correta?
- EXAMES: Pediu o necessário? Pediu excessos inúteis?
- DIAGNÓSTICO: Precisão e diferenciais considerados.
- CONDUTA: Segurança, efetividade e tempo de resposta.

Responda SEMPRE em JSON válido:
{
  "patient_presentation": "texto da apresentação ou resposta do paciente",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "setting": "PS / UTI / Enfermaria / Ambulatório",
  "triage_color": "vermelho/laranja/amarelo/verde",
  "patient_status": "estável/instável/grave/crítico",
  "score_delta": { "anamnesis": 0, "physical_exam": 0, "complementary_exams": 0, "management": 0 },
  "teaching_tip": "dica didática curta (se learner_mode=true)",
  "hidden_diagnosis": "diagnóstico real (oculto)",
  "is_deteriorating": boolean,
  "maneuvers_performed": [{ "name": "...", "technique": "...", "finding": "...", "interpretation": "..." }]
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, ok, response } = await requireAuth(req);
    if (!ok) return response;

    const { 
      action, 
      message, 
      conversation_history, 
      specialty, 
      triage_color, 
      teacher_case_id,
      deterioration_level,
      learner_mode,
      realistic_mode,
      specialist_area
    } = await req.json();

    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (action === "start") {
      if (teacher_case_id) {
        const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: teacherCase } = await supabaseService.from("teacher_clinical_cases").select("*").eq("id", teacher_case_id).single();
        if (teacherCase) {
          messages.push({ role: "user", content: `Inicie o caso de professor: ${teacherCase.case_prompt}` });
        }
      } else {
        messages.push({ role: "user", content: `action="start". Especialidade: ${specialty || "Clínica Médica"}. Triage: ${triage_color || "AMARELO"}.` });
      }
    } else {
      if (conversation_history) {
        messages.push(...conversation_history.slice(-10));
      }
      
      if (action === "interact") {
        messages.push({ role: "user", content: `Ação do médico: ${message}` });
      } else if (action === "deteriorate") {
        messages.push({ role: "user", content: `O paciente está deteriorando (Nível ${deterioration_level || 1}).` });
      } else if (action === "finish") {
        messages.push({ role: "user", content: `Encerrar atendimento e avaliar conduta.` });
      }
    }

    const aiResp = await aiFetch({
      model: "google/gemini-2.0-flash-001",
      messages,
      timeoutMs: 60000,
    });

    if (!aiResp.ok) throw new Error("Erro na IA");

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
    const parsed = safeParseAIJson(raw, action);

    // Salvar métricas se encerrar
    if (action === "finish") {
      const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await updatePerformanceMetrics(supabaseService, {
        userId: user.id,
        specialty: specialty || "Geral",
        topic: String(parsed.correct_diagnosis || "Simulação"),
        isCorrect: (Number(parsed.final_score) || 0) >= 70,
      });
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
  }
});
