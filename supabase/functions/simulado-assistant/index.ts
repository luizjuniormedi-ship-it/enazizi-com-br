import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, extractUserId, getAdmin, getCache, setCache,
  checkAndIncrementUsage, ACTION_COSTS, callHeavyAI, parseAiJsonSafe,
  jsonOk, jsonError,
} from "../_shared/ai-phase2-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await extractUserId(req);
    if (!userId) return jsonError("Não autenticado", 401);

    const { size = 10, examProfile } = await req.json();
    const questionCount = Math.min(Math.max(size, 5), 30);

    // Usage check (cost = 10)
    const usage = await checkAndIncrementUsage(userId, ACTION_COSTS.adaptive_simulado);
    if (!usage.allowed) {
      return jsonOk({
        questions: [],
        distribution: { weakTopics: 0, strongTopics: 0, reviewTopics: 0 },
        source: "fallback",
        error: "Limite de uso atingido. Tente novamente no próximo período.",
      });
    }

    const sb = getAdmin();

    // 1. Fetch weak topics from error_bank
    const { data: weakErrors } = await sb
      .from("error_bank")
      .select("tema, subtema, vezes_errado")
      .eq("user_id", userId)
      .eq("dominado", false)
      .order("vezes_errado", { ascending: false })
      .limit(10);

    // 2. Fetch pending reviews
    const { data: pendingReviews } = await sb
      .from("revisoes")
      .select("tema, subtema")
      .eq("user_id", userId)
      .eq("status", "pendente")
      .limit(10);

    // 3. Approval score for difficulty calibration
    const { data: scoreRow } = await sb
      .from("approval_scores")
      .select("score")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const approvalScore = scoreRow?.score ?? 50;

    // Build distribution
    const weakCount = Math.round(questionCount * 0.4);
    const reviewCount = Math.round(questionCount * 0.3);
    const mixedCount = questionCount - weakCount - reviewCount;

    const weakTopics = (weakErrors || []).slice(0, 5).map((e) => e.subtema || e.tema);
    const reviewTopics = (pendingReviews || []).slice(0, 5).map((r) => r.subtema || r.tema);

    // Determine difficulty based on approval score
    let difficultyHint = "misto (20% fácil, 50% intermediário, 30% difícil)";
    if (approvalScore < 40) difficultyHint = "maioria fácil e intermediário";
    else if (approvalScore > 75) difficultyHint = "maioria intermediário e difícil";

    const system = `Você é um professor de medicina montando um simulado personalizado para prova de residência.
Retorne um JSON com "questions": array de objetos, cada um com: "question" (enunciado clínico, mín 150 chars), "options" (5 alternativas A-E), "correctAnswer" (letra), "explanation" (mín 100 chars), "difficulty" (easy/medium/hard), "topic" (tema).
Use português do Brasil. Estilo de prova real.${examProfile ? ` Banca: ${examProfile}.` : ""}`;

    const prompt = `Monte um simulado com ${questionCount} questões.

DISTRIBUIÇÃO:
- ${weakCount} questões sobre TEMAS FRACOS: ${weakTopics.length ? weakTopics.join(", ") : "temas gerais de clínica médica"}
- ${reviewCount} questões sobre REVISÃO: ${reviewTopics.length ? reviewTopics.join(", ") : "temas variados"}
- ${mixedCount} questões MISTAS de outras áreas

DIFICULDADE: ${difficultyHint}
APPROVAL SCORE: ${approvalScore}/100

Gere questões variadas, cobrindo diferentes aspectos de cada tema.`;

    const raw = await callHeavyAI(system, prompt, 8192);
    const parsed = parseAiJsonSafe(raw);

    const questions = Array.isArray(parsed.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];

    const result = {
      questions,
      distribution: {
        weakTopics: weakCount,
        strongTopics: mixedCount,
        reviewTopics: reviewCount,
      },
    };

    return jsonOk({ ...result, source: "ai" });
  } catch (e) {
    console.error("simulado-assistant error:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AI_RATE_LIMITED") return jsonError("Muitas requisições. Aguarde.", 429);
    if (msg === "AI_CREDITS_EXHAUSTED") return jsonError("Créditos esgotados.", 402);
    return jsonError("Erro ao gerar simulado", 500);
  }
});
