import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, parseAiJson, cleanQuestionText } from "../_shared/ai-fetch.ts";
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/require-auth.ts";
import { SIMULADO_MOTOR_PREMIUM, QUESTION_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(enterpriseEdgeHandler("generate-adaptive-simulado", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));

  logger.info("ADAPTIVE_SIM_START", "Analyzing performance and generating adaptive blueprint", { userId: user.id });

  const targetCount = Math.min(body.target_question_count || 10, 30);
  
  // 1. Get performance profile
  const performance = body.performance || {
    by_modality: { ecg: 50, xray: 50, ct: 50 },
    by_difficulty: { easy: 50, medium: 50, hard: 50 },
    response_time: {},
    error_patterns: [],
  };

  // 2. Try to fetch from bank first
  const questions: any[] = [];
  
  // Simple heuristic: fetch topics user is weak in
  const weakTopics = Object.entries(performance.by_modality as Record<string, number>)
    .filter(([_, score]) => score < 60)
    .map(([topic]) => topic);

  if (weakTopics.length > 0) {
      const { data: bankQs } = await supabaseAdmin
        .from("questions_bank")
        .select("*")
        .in("topic", weakTopics)
        .limit(targetCount);
      
      if (bankQs) {
          questions.push(...bankQs.map(q => ({
            id: q.id,
            statement: q.statement,
            options: q.options,
            correct: q.correct_index,
            explanation: q.explanation,
            topic: q.topic,
            difficulty: q.difficulty,
            _source: "bank"
          })));
      }
  }

  // 3. If not enough questions, generate via IA
  const deficit = targetCount - questions.length;
  if (deficit > 0) {
      logger.info("ADAPTIVE_SIM_GENERATING", `Generating ${deficit} questions via AI`);
      
      const topicToGen = weakTopics[0] || "Clínica Médica";
      
      const aiResponse = await ai({
          taskType: "generation",
          messages: [
              { role: "system", content: QUESTION_MOTOR_PREMIUM + "\n" + SIMULADO_MOTOR_PREMIUM },
              { role: "user", content: `Gere ${deficit} questões médicas adaptativas sobre ${topicToGen}. Foque em padrões de erro comuns.` }
          ],
          complexity: "high"
      });

      const rawContent = aiResponse.choices?.[0]?.message?.content || "[]";
      const generated = parseAiJson(rawContent);
      
      if (Array.isArray(generated)) {
          questions.push(...generated.slice(0, deficit).map(q => ({
              statement: cleanQuestionText(q.statement || q.content || ""),
              options: q.options || [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean),
              correct: typeof q.correct === 'number' ? q.correct : (typeof q.correct_index === 'number' ? q.correct_index : 0),
              explanation: cleanQuestionText(q.explanation || q.rationale || ""),
              topic: q.topic || topicToGen,
              difficulty: q.difficulty || "hard",
              _source: "generated"
          })));
      }
  }

  // 4. Finalize session
  if (questions.length > 0) {
      const { data: session, error: sessErr } = await supabaseAdmin.from("simulado_sessions").insert({
          user_id: user.id,
          mode: 'adaptativo',
          total_questions: questions.length,
          status: 'active',
          metadata: { adaptive_meta: performance }
      }).select().single();

      if (sessErr) throw sessErr;

      await supabaseAdmin.from("simulado_questions").insert(
          questions.map((q, idx) => ({
              session_id: session.id,
              question_id: q.id || null, // Might be null if it's purely generated and not saved yet
              order_index: idx
          }))
      );

      return new Response(JSON.stringify({
          success: true,
          sessionId: session.id,
          questions: questions,
          total: questions.length
      }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  throw new Error("Não foi possível obter questões para o simulado.");
}));
