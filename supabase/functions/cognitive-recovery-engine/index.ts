
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdFromRequest(req);
    const { trigger_reason } = await req.json().catch(() => ({}));

    // Protocol based on reason
    let action_type = "mini_quiz";
    let content = { title: "Recuperação Leve", message: "Que tal um mini-quiz rápido para manter o ritmo?" };

    if (trigger_reason === "high_fatigue") {
      action_type = "cinematic_break";
      content = { title: "Pausa Produtiva", message: "Assista a uma crônica médica curta para relaxar e aprender." };
    } else if (trigger_reason === "low_retention") {
      action_type = "feynman_simplified";
      content = { title: "Active Recall", message: "Tente explicar o último conceito em 2 frases." };
    }

    const recovery = {
      user_id: userId,
      trigger_reason,
      action_type,
      generated_content: content,
      success: true
    };

    await supabase.from("recovery_actions").insert(recovery);

    return jsonResponse({
      success: true,
      action: action_type,
      content
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
