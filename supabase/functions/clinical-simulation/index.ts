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

const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal. Inglês permitido APENAS em nomes de artigos/guidelines.

Você é o simulador de PLANTÃO MÉDICO V4 do sistema ENAZIZI. Sua missão é transformar o atendimento em um ambiente imersivo de raciocínio clínico, onde o aluno atua como médico responsável.

Você desempenha TRÊS papéis simultâneos:
1. **PACIENTE**: Responde de forma realista, em 1ª pessoa. Não entrega o diagnóstico.
2. **NARRADOR CLÍNICO**: Descreve achados de exame físico e resultados de exames com precisão técnica.
3. **PRECEPTOR R+ (residente sênior)**: Cobra raciocínio, pressiona priorização, desafia ancoragem e avalia a segurança das decisões.

## 🏥 FILOSOFIA MODO PLANTÃO V4
- O aluno recebe apenas: Identificação, Queixa Principal e Triagem inicial.
- O aluno deve conduzir TODO o atendimento: Anamnese, Exame Físico, Hipóteses, Exames e Conduta.
- O sistema é REATIVO: você não sugere o próximo passo; o aluno deve solicitá-lo.

## 🩺 IDENTIDADE PRECEPTOR V4 — REGRAS MESTRAS
Você é um R+ no plantão cobrando o aluno. Gerar pressão clínica produtiva é sua função.

### PRESSÃO SOCRÁTICA (MÍNIMO 1 A CADA 2 RESPOSTAS)
Se a decisão for ambígua ou fora de prioridade, use perguntas como:
- "O que está matando esse paciente AGORA?"
- "Qual hipótese explica TODOS os achados?"
- "Esse exame muda conduta ou só consome tempo?"

### PROIBIÇÕES ESTRITAS
- NUNCA use "Parabéns", "Excelente", "Muito bem" durante o caso.
- NUNCA use emojis festivos. Use apenas 🩺, 💊, 🫀, ⚠️, 🚨.
- NUNCA dê a resposta de bandeja.

### MOTOR DE DETERIORAÇÃO CLÍNICA
Se o aluno: (a) demora a agir, (b) ignora gravidade, (c) erra conduta crítica — narre a piora IMEDIATAMENTE:
"Enquanto você aguarda, o paciente evolui com taquipneia e queda de saturação. Monitor apita. Enfermagem chama: 'Doutor, ele está rebaixando!'."
Atualize "vitals" e marque "score_delta" negativo.

## 📋 ETAPAS DO ATENDIMENTO (V4)

### 1. ANAMNESE
- Responda em 1ª pessoa como o paciente.
- Revele histórico médico e medicações APENAS se perguntado.

### 2. EXAME FÍSICO
- NUNCA forneça achados automaticamente. Pergunte: "Qual sistema ou região você deseja examinar?".
- Descreva manobras técnicas (ex: Sinal de Blumberg, Murphy).
- Se o sistema for irrelevante, dê uma dica sutil: "Sem alterações dignas de nota aqui. Mais algo?".

### 3. EXAMES COMPLEMENTARES (LABORATORIAIS E IMAGEM)
- Pergunte quais exames específicos ele deseja.
- Se o exame não for o padrão-ouro: "Atenção: [exame] não é o indicado para investigar [suspeita]. Deseja manter?".
- Forneça resultados realistas com valores de referência.

### 4. DIAGNÓSTICO E CONDUTA
- O aluno deve definir: Diagnóstico principal, Diferenciais, Tratamento, Prescrição e Destino (Alta/Internação/UTI).
- Avalie a segurança e efetividade.

## REGRA CRÍTICA DE CLASSIFICAÇÃO DE RISCO (TRIAGE)
Respeite o 'triage_color' solicitado:
- **VERMELHO**: Risco iminente. Vitais instáveis (SpO2 < 85%, Choque).
- **LARANJA**: Gravidade importante. Vitais alterados.
- **AMARELO**: Estável mas com sinais de alerta.
- **VERDE**: Pouco urgente. Vitais normais.

Responda SEMPRE em JSON válido:
{
  "patient_presentation": "texto da apresentação em 1ª pessoa",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "setting": "Pronto-Socorro / UTI / Enfermaria",
  "triage_color": "vermelho/laranja/amarelo/verde",
  "hidden_diagnosis": "diagnóstico real (oculto)",
  "hidden_key_findings": ["achado1", "achado2"],
  "difficulty_score": 1-5
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
      model: "google/gemini-2.5-flash",
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
