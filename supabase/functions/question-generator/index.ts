import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { aiFetch, cleanQuestionText, parseAiJson } from "../_shared/ai-fetch.ts";
import { QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { resolveBanca, buildBancaBlock } from "../_shared/banca-profiles.ts";

Deno.serve(enterpriseEdgeHandler("question-generator", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));

  const { 
    difficulty = "misto", 
    count = 5,
    generationContext = {},
    targetExam,
    topicWeights
  } = body;

  const requestedCount = Math.min(Number(count), 15);
  const specialty = body.specialty || generationContext.specialty || "Clínica Médica";
  const topics = body.topics || (generationContext.topic ? [generationContext.topic] : [specialty]);
  const examBoard = targetExam || body.examBoard;

  logger.info("QUESTION_GEN_START", `Generating ${requestedCount} questions for ${specialty}`, { userId: user.id, topics, examBoard });

  // Try to find existing questions in bank first to avoid AI costs if possible
  if (body.preferBank) {
      const { data: bankQs } = await supabaseAdmin
        .from("questions_bank")
        .select("*")
        .eq("topic", specialty)
        .limit(requestedCount);
      
      if (bankQs && bankQs.length >= requestedCount) {
          logger.info("QUESTION_GEN_BANK_HIT", `Found ${bankQs.length} questions in bank`);
          return new Response(JSON.stringify({ 
            success: true, 
            questions: bankQs,
            choices: [{ message: { content: JSON.stringify(bankQs) } }] 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
      }
  }

  const bancaInfo = resolveBanca(examBoard || "default");
  let systemPrompt = QUESTION_MOTOR_PREMIUM;
  systemPrompt += buildBancaBlock(bancaInfo.profile);

  const userPrompt = `Gere exatamente ${requestedCount} questões médicas de múltipla escolha.
  TEMA: ${topics.join(", ")}
  ESPECIALIDADE: ${specialty}
  DIFICULDADE: ${difficulty}
  ${examBoard ? `ESTILO DA BANCA: ${examBoard}` : ""}
  
  REGRAS:
  1. Caso clínico denso (400+ caracteres).
  2. 5 alternativas (A-E).
  3. Explicação detalhada.
  4. Retorne APENAS um JSON array.`;

  try {
    const aiResponse = await ai({
      taskType: "generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      complexity: "high"
    });

    const rawContent = aiResponse.choices?.[0]?.message?.content || "[]";
    let questions = parseAiJson(rawContent);

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("Falha ao gerar questões válidas via IA.");
    }

    // Format and sanitize
    const formattedQuestions = questions.map(q => ({
        statement: cleanQuestionText(q.statement || q.content || ""),
        options: Array.isArray(q.options) ? q.options : [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean),
        correct: typeof q.correct === 'number' ? q.correct : (typeof q.correct_index === 'number' ? q.correct_index : 0),
        explanation: cleanQuestionText(q.explanation || q.rationale || ""),
        topic: q.topic || specialty,
        difficulty: q.difficulty || difficulty,
        metadata: { 
            generation_engine: "ENAZIZI Question Motor v3.2",
            generated_at: new Date().toISOString()
        }
    }));

    // Optionally save to questions_bank for future use
    if (body.saveToBank) {
        await supabaseAdmin.from("questions_bank").insert(
            formattedQuestions.map(q => ({
                user_id: user.id,
                statement: q.statement,
                options: q.options,
                correct_index: q.correct,
                explanation: q.explanation,
                topic: q.topic,
                difficulty: q.difficulty,
                is_global: true,
                review_status: 'pending'
            }))
        );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      questions: formattedQuestions,
      choices: [{ message: { content: JSON.stringify(formattedQuestions) } }] 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    logger.error("QUESTION_GEN_FAIL", err.message);
    return new Response(JSON.stringify({ error: err.message, success: false }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}));
