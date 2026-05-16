import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { validateAIOutput } from "../_shared/ai-validation.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Loop 3E: getClaims + getUser fallback antes de qualquer chamada IA.
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const userId = auth.userId;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const user = { id: userId };

    const { action, ...params } = await req.json();
    const ok = (data: unknown) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    switch (action) {
      case "generate": {
        const { specialty, difficulty = "intermediário" } = params;
        if (!specialty) throw new Error("Especialidade obrigatória");

        const prompt = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês.

Gere UMA questão discursiva de residência médica sobre ${specialty}, nível ${difficulty}.

A questão DEVE conter:
- Um caso clínico detalhado (história, exame físico, exames complementares quando pertinente)
- Uma pergunta aberta que exija raciocínio clínico completo

REGRAS:
- Baseie-se em provas reais de residência (ENARE, USP, UNIFESP)
- O caso deve ser realista e desafiador
- A pergunta deve exigir: diagnóstico, diagnósticos diferenciais, conduta e/ou justificativa

ANAMNESE ÚNICA (REGRA ABSOLUTA):
- Cada caso DEVE ter um paciente COMPLETAMENTE DIFERENTE dos anteriores
- Variar: nomes regionais brasileiros, idades de 0 a 95 anos, profissões diversas
- Alternar cenários: PS, enfermaria, UTI, UBS, SAMU, ambulatório, domicílio
- Variar comorbidades: DM, HAS, IRC, HIV, tabagismo, etilismo, gestante, imunossuprimido
- Variar queixa principal e tempo de evolução (horas, dias, semanas, meses)
- PROIBIDO: repetir perfil demográfico de paciente já usado anteriormente

Retorne APENAS um JSON válido:
{
  "case": "Texto completo do caso clínico",
  "questions": [
    "Primeira pergunta (ex: Qual o diagnóstico mais provável? Justifique.)",
    "Segunda pergunta (ex: Cite 3 diagnósticos diferenciais relevantes.)",
    "Terceira pergunta (ex: Descreva a conduta terapêutica inicial.)"
  ],
  "expected_topics": ["tópico 1 esperado na resposta", "tópico 2", "tópico 3"],
  "grading_criteria": [
    {"criterion": "Diagnóstico correto", "max_points": 3},
    {"criterion": "Diagnósticos diferenciais pertinentes", "max_points": 2},
    {"criterion": "Conduta adequada", "max_points": 3},
    {"criterion": "Justificativa e raciocínio clínico", "max_points": 2}
  ]
}

REGRA: Gere SEMPRE entre 2 e 4 sub-perguntas separadas, cada uma focada em um aspecto diferente do caso.`;

        const startMs = Date.now();
        const response = await aiFetch({
          messages: [{ role: "user", content: prompt }],
          model: "openai/gpt-5-mini",
        });
        const elapsed = Date.now() - startMs;

        if (!response.ok) {
          logAiUsage({ userId: user.id, functionName: "discursive-questions", modelUsed: "openai/gpt-5-mini", success: false, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});
          throw new Error("Erro ao gerar questão");
        }

        const aiData = await response.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        // Sanitize control characters that break JSON.parse
        const content = rawContent.replace(/[\x00-\x1F\x7F]/g, (ch: string) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' ');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Erro ao processar questão gerada");

        const questionData = JSON.parse(jsonMatch[0]);
        logAiUsage({ userId: user.id, functionName: "discursive-questions", modelUsed: "openai/gpt-5-mini", success: true, responseTimeMs: elapsed, cacheHit: false, modelTier: "fast" }).catch(() => {});

        // Validate AI output
        const validation = validateAIOutput(questionData, { specialty }, "discursiva");
        if (!validation.valid) {
          console.warn(`[discursive-questions] Rejected: ${validation.reason} | ${specialty}`);
          // Still proceed — the content passed structural parse, just log the issue
        }

        // Normalize: support both old "question" (string) and new "questions" (array) formats
        const questions: string[] = Array.isArray(questionData.questions)
          ? questionData.questions
          : [questionData.question || ""];

        // Save to DB
        const fullText = `${questionData.case}\n\n${questions.join("\n\n")}`;
        const { data: attempt, error: insertErr } = await sb.from("discursive_attempts").insert({
          user_id: user.id,
          specialty,
          question_text: fullText,
          ai_correction: { grading_criteria: questionData.grading_criteria, expected_topics: questionData.expected_topics },
          status: "pending",
          max_score: 10,
        }).select("id").single();

        if (insertErr) throw new Error(insertErr.message);

        return ok({ id: attempt.id, case: questionData.case, questions, grading_criteria: questionData.grading_criteria });
      }

      case "correct": {
        const { attempt_id, answer } = params;
        if (!attempt_id || !answer) throw new Error("attempt_id e answer obrigatórios");

        // Fetch the attempt
        const { data: attempt, error: fetchErr } = await sb
          .from("discursive_attempts")
          .select("*")
          .eq("id", attempt_id)
          .eq("user_id", user.id)
          .single();

        if (fetchErr || !attempt) throw new Error("Tentativa não encontrada");

        const criteria = (attempt.ai_correction as any)?.grading_criteria || [];
        const expectedTopics = (attempt.ai_correction as any)?.expected_topics || [];

        const prompt = `Você é um examinador de prova de Residência Médica. Corrija a resposta discursiva abaixo com rigor e critérios de banca.

QUESTÃO:
${attempt.question_text}

RESPOSTA DO ALUNO:
${answer}

TÓPICOS ESPERADOS NA RESPOSTA:
${expectedTopics.join(", ")}

CRITÉRIOS DE AVALIAÇÃO (total 10 pontos):
${criteria.map((c: any) => `- ${c.criterion}: até ${c.max_points} pontos`).join("\n")}

INSTRUÇÕES:
1. Avalie cada critério separadamente
2. Seja justo mas rigoroso como uma banca real
3. Destaque acertos e erros específicos
4. Forneça a resposta modelo completa

Retorne APENAS um JSON válido:
{
  "total_score": 7.5,
  "max_score": 10,
  "criteria_scores": [
    {"criterion": "Diagnóstico correto", "score": 2.5, "max": 3, "feedback": "Comentário específico"},
    {"criterion": "Diagnósticos diferenciais", "score": 1.5, "max": 2, "feedback": "Comentário"},
    {"criterion": "Conduta adequada", "score": 2, "max": 3, "feedback": "Comentário"},
    {"criterion": "Justificativa", "score": 1.5, "max": 2, "feedback": "Comentário"}
  ],
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
  "model_answer": "A resposta completa e ideal para esta questão é...",
  "overall_feedback": "Feedback geral sobre o desempenho"
}`;

        const response = await aiFetch({
          messages: [{ role: "user", content: prompt }],
          model: "openai/gpt-5-mini",
        });

        if (!response.ok) throw new Error("Erro ao corrigir resposta");

        const aiData = await response.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "";
        const content = rawContent.replace(/[\x00-\x1F\x7F]/g, (ch: string) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' ');
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Erro ao processar correção");

        const correction = JSON.parse(jsonMatch[0]);

        // Update attempt
        await sb.from("discursive_attempts").update({
          student_answer: answer,
          ai_correction: { ...attempt.ai_correction, correction },
          score: correction.total_score,
          status: "corrected",
          finished_at: new Date().toISOString(),
        }).eq("id", attempt_id);

        return ok({ correction });
      }

      case "history": {
        const { data: attempts } = await sb
          .from("discursive_attempts")
          .select("id, specialty, score, max_score, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        return ok({ attempts: attempts || [] });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("discursive-questions error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
