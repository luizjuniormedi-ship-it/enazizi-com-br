
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: only authenticated users can audit questions
    const userId = await getUserIdFromRequest(req).catch(() => null);
    if (!userId) return errorResponse("Não autenticado", 401);

    const supabase = getServiceClient();
    const { question_id } = await req.json().catch(() => ({}));

    if (!question_id) return errorResponse("question_id required", 400);

    const { data: question } = await supabase
      .from("questions_bank")
      .select("*")
      .eq("id", question_id)
      .single();

    if (!question) return errorResponse("Question not found", 404);

    // AI Logic to audit quality (Mocked logic for now, using structured rules)
    let score = 0.9;
    let issues = [];

    if (!question.explanation) {
      score -= 0.3;
      issues.push("Missing explanation");
    }
    if (!question.difficulty) {
      score -= 0.1;
      issues.push("Missing difficulty metadata");
    }

    await supabase.from("ai_agents_logs").insert({
      agent_name: "Question Quality Agent",
      action: "AUDIT_QUESTION",
      confidence: score,
      decision_payload: { question_id, score, issues }
    });

    return jsonResponse({
      success: true,
      score,
      issues
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
