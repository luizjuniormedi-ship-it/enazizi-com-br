import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês.

Você é o simulador de PROVA PRÁTICA MÉDICA (estilo OSCE/residência) do sistema ENAZIZI.

## FORMATO DE RESPOSTA
Sempre retorne JSON válido. Nunca inclua texto fora do JSON.

## AÇÕES

### action: "generate_case"
Gere um caso clínico estruturado para prova prática com múltiplas etapas.
Retorne JSON:
{
  "case_id": "string aleatória",
  "title": "título curto do caso",
  "specialty": "especialidade",
  "difficulty": "básico|intermediário|avançado",
  "patient_presentation": "descrição do paciente (idade, sexo, queixa principal, sinais vitais)",
  "steps": [
    {
      "step_id": 1,
      "phase": "anamnese|exame_fisico|exames_complementares|diagnostico|conduta",
      "prompt": "o que o examinador pergunta/pede ao aluno",
      "time_limit_seconds": 60,
      "options": [
        {"id": "a", "text": "opção A"},
        {"id": "b", "text": "opção B"},
        {"id": "c", "text": "opção C"},
        {"id": "d", "text": "opção D"}
      ],
      "correct_id": "a",
      "explanation": "por que esta é a melhor resposta",
      "weight": 2
    }
  ]
}

Regras para geração:
- Mínimo 5 etapas, máximo 8
- Cobrir obrigatoriamente: anamnese, exame físico, diagnóstico e conduta
- Opções devem ser plausíveis (diferenciais reais)
- Peso (weight) de 1 a 3 conforme importância clínica
- Tempo por decisão: 30-90s conforme complexidade
- Dificuldade "avançado": casos atípicos, diferenciais difíceis
- Variar cenários clínicos (PS, UPA, enfermaria, UTI)
- Incluir dados epidemiológicos atualizados (2024-2026)

### action: "evaluate"
Receba as respostas do aluno e gere avaliação completa.
Input inclui: steps (com correct_id), answers (escolhas do aluno), times (tempo por etapa).
Retorne JSON:
{
  "scores": {
    "raciocinio_clinico": 0-10,
    "conduta": 0-10,
    "priorizacao": 0-10,
    "tempo": 0-10
  },
  "final_score": 0-10,
  "grade": "A|B|C|D|F",
  "feedback": [
    {
      "step_id": 1,
      "correct": true/false,
      "comment": "feedback específico"
    }
  ],
  "summary": "resumo geral do desempenho em 2-3 frases",
  "improvement_tips": ["dica 1", "dica 2", "dica 3"],
  "strong_points": ["ponto forte 1"],
  "weak_points": ["ponto fraco 1"]
}

Critérios de avaliação:
- raciocinio_clinico: capacidade de formular hipóteses e diferenciais
- conduta: adequação das decisões terapêuticas
- priorizacao: sequência lógica de investigação
- tempo: eficiência (penalizar decisões muito lentas)
- Grade: A (≥9), B (≥7), C (≥5), D (≥3), F (<3)
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, specialty, difficulty, steps, answers, times, case_summary } = body;

    if (action === "generate_case") {
      const startMs = Date.now();
      const response = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `action: "generate_case"\nEspecialidade: ${specialty || "Clínica Médica"}\nDificuldade: ${difficulty || "intermediário"}\n\nGere o caso clínico em JSON.`,
          },
        ],
        maxTokens: 4096,
        timeoutMs: 30000,
      });
      const elapsed = Date.now() - startMs;

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", errText.slice(0, 300));
        logAiUsage({ userId: user.id, functionName: "practical-exam", modelUsed: "openai/gpt-5-mini", success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast", errorMessage: `status ${response.status}` }).catch(() => {});
        return new Response(JSON.stringify({ error: "Erro ao gerar caso clínico" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      const parsed = parseAiJson(content);
      logAiUsage({ userId: user.id, functionName: "practical-exam", modelUsed: "openai/gpt-5-mini", success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "evaluate") {
      const startMs2 = Date.now();
      const response = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `action: "evaluate"\n\nEtapas do caso:\n${JSON.stringify(steps)}\n\nRespostas do aluno:\n${JSON.stringify(answers)}\n\nTempos por etapa (segundos):\n${JSON.stringify(times)}\n\nAvalie o desempenho em JSON.`,
          },
        ],
        maxTokens: 2048,
        timeoutMs: 25000,
      });
      const elapsed2 = Date.now() - startMs2;

      if (!response.ok) {
        logAiUsage({ userId: user.id, functionName: "practical-exam-evaluate", modelUsed: "openai/gpt-5-mini", success: false, responseTimeMs: elapsed2, cacheHit: false, modelTier: "fast" }).catch(() => {});
        return new Response(JSON.stringify({ error: "Erro ao avaliar desempenho" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logAiUsage({ userId: user.id, functionName: "practical-exam-evaluate", modelUsed: "openai/gpt-5-mini", success: true, responseTimeMs: elapsed2, cacheHit: false, modelTier: "fast" }).catch(() => {});

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      const evaluation = parseAiJson(content);

      // Save result to database
      const totalTime = (times || []).reduce((s: number, t: number) => s + t, 0);
      await supabase.from("practical_exam_results").insert({
        user_id: user.id,
        specialty: specialty || "Clínica Médica",
        difficulty: difficulty || "intermediário",
        case_summary: case_summary || "",
        scores_json: evaluation.scores || {},
        final_score: evaluation.final_score || 0,
        feedback_json: evaluation,
        time_total_seconds: totalTime,
        steps_json: steps || [],
      });

      return new Response(JSON.stringify(evaluation), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("practical-exam error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
