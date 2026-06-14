import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { claudeFetchQuestionsMicrobatch, claudeHealthCheck, claudeMinimalTest, claudeWarmup } from "../_shared/eu-ai-questions-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildIamPrompt(count: number): string {
  return `Gere exatamente ${count} questão(ões) objetivas de múltipla escolha (A-D) para residência médica sobre: IAM.

IDIOMA OBRIGATÓRIO: português brasileiro estrito.
DIFICULDADE: FÁCIL — apresentação típica, diagnóstico direto, sem pegadinhas.
BANCA: ENAMED.
Todas as questões devem preservar o tema IAM no campo "topic".

Retorne APENAS um array JSON válido com este schema:
[
  {
    "block": "IAM",
    "statement": "Caso clínico completo em português com pelo menos 300 caracteres e pergunta objetiva",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_index": 0,
    "explanation": "Explicação em português com bibliografia médica",
    "topic": "IAM",
    "difficulty_level": "facil"
  }
]`;
}

async function runGeneration(count: number) {
  const t0 = Date.now();
  const response = await claudeFetchQuestionsMicrobatch(buildIamPrompt(count), "IAM", count);
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "[]";
  let questions: any[] = [];
  try { questions = JSON.parse(text); } catch { questions = []; }
  return {
    ok: response.ok,
    status: response.status,
    requested: count,
    parsed: questions.length,
    elapsedMs: Date.now() - t0,
    topicPreserved: questions.every((q) => String(q?.topic || "").toUpperCase() === "IAM" || String(q?.block || "").toUpperCase() === "IAM"),
    preview: questions.map((q) => String(q?.statement || "").slice(0, 120)),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "all");

    const [health, warmup, minimal] = await Promise.all([
      claudeHealthCheck(),
      claudeWarmup(),
      claudeMinimalTest(),
    ]);

    const tests: any[] = [];
    if (mode === "one") {
      tests.push(await runGeneration(1));
    } else if (mode === "two") {
      tests.push(await runGeneration(2));
    } else if (mode === "five") {
      tests.push(await runGeneration(5));
    } else if (mode === "all" || mode === "progressive") {
      tests.push(await runGeneration(1));
      tests.push(await runGeneration(2));
      tests.push(await runGeneration(5));
    }

    const oneQuestionTimeout = tests.some((t) => t.requested === 1 && (!t.ok || t.status === 599));
    const diagnosis = oneQuestionTimeout
      ? "RAILWAY_PROXY_OR_ANTHROPIC_SDK_REQUIRED"
      : "EDGE_RECOVERY_EXECUTED";

    return jsonResponse({
      success: true,
      health,
      warmup,
      minimal,
      tests,
      diagnosis,
      openai: "FALLBACK_ONLY",
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      diagnosis: "CLAUDE_RECOVERY_PROBE_FAILED",
      elapsedMs: Date.now() - startedAt,
    }, 500);
  }
});