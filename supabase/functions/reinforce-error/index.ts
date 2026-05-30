import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  extractUserId,
  getCache,
  setCache,
  checkAndIncrementUsage,
  callLightAI,
  jsonOk,
  jsonError,
  fallbackMessage,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { theme, errorType, userAnswer, questionId } = await req.json();
    if (!theme) return jsonError("theme é obrigatório");

    const cacheParams = { theme, errorType: errorType || "", userAnswer: userAnswer || "" };
    const cached = await getCache("reinforce_error", cacheParams);
    if (cached.hit) {
      return jsonOk({ ...cached.data, source: "cache" });
    }

    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return jsonOk({
        explanation: fallbackMessage(theme),
        correction: "Revise o conteúdo teórico antes de tentar novamente.",
        tip: "Releia o tema no seu material de estudo.",
        source: "fallback",
      });
    }

    const system = `Você é o Mentor de Banco de Erros do ENAZIZI, especializado em corrigir erros de prova de Residência Médica.

REGRAS ABSOLUTAS:
- Responda APENAS em português do Brasil.
- Não crie aula longa. Não invente dados. Não contradiga o gabarito.
- Sempre analise: alternativa correta, alternativa marcada pelo aluno, demais alternativas (quando fornecidas), erro cognitivo provável, armadilha da banca, regra de ouro memorizável e pergunta curta de fixação.
- Classifique o erro provável em UMA destas categorias: "Conhecimento insuficiente", "Leitura incompleta", "Confusão entre diagnósticos", "Confusão entre condutas", "Pegadinha da banca", "Falha de priorização clínica", "Excesso de raciocínio".

FORMATO DE SAÍDA — JSON ESTRITO, sem texto fora do JSON:
{
  "explanation": "Correção objetiva em até 5 linhas explicando o raciocínio central e por que a alternativa correta é correta.",
  "correction": "Análise da alternativa marcada pelo aluno (por que está errada) + análise das demais alternativas fornecidas (A/B/C/D, cada uma com motivo curto).",
  "tip": "Erro provável: [categoria] — [1 frase]. Armadilha da banca: [até 2 linhas]. Regra de ouro: [frase curta memorizável]. Pergunta de fixação: [pergunta curta].",
  "confidence": "high|medium|low"
}

CRITÉRIO DE QUALIDADE antes de retornar:
- analisou a resposta correta?
- explicou por que a marcada está errada?
- analisou alternativas quando fornecidas?
- identificou erro cognitivo?
- trouxe dica prática para prova?

Se faltar dado essencial (ex: alternativas não fornecidas), retornar "confidence":"low" e mencionar a limitação brevemente dentro de "correction". Nunca deixar campos vazios.`;

    const prompt = `Tema: ${theme}${errorType ? `\nTipo de erro registrado: ${errorType}` : ""}${userAnswer ? `\nResposta do aluno: ${userAnswer}` : ""}\n\nGere a correção pedagógica seguindo o formato JSON obrigatório.`;

    const raw = await callLightAI(system, prompt);

    let result: { explanation: string; correction: string; tip: string; confidence?: string };
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { explanation: raw, correction: "", tip: "", confidence: "low" };
    } catch {
      result = { explanation: raw, correction: "", tip: "", confidence: "low" };
    }

    // Defensive fallback: garantir contrato mesmo se IA omitir campos
    result.explanation = result.explanation || raw.slice(0, 400) || fallbackMessage(theme);
    result.correction = result.correction || "Análise das alternativas indisponível neste retorno.";
    result.tip = result.tip || "Revise o tema no material de referência.";
    result.confidence = result.confidence || "medium";

    await setCache(cached.key, "reinforce_error", result);
    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("reinforce-error error:", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar reforço", 500);
  }
});
