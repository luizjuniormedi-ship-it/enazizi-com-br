
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, jsonResponse, errorResponse, getServiceClient, getUserIdFromRequest } from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserIdFromRequest(req).catch(() => null);
    if (!userId) return errorResponse("Não autenticado", 401);

    const supabase = getServiceClient();
    const { topic, duration_seconds = 60 } = await req.json().catch(() => ({}));

    // Scene Graph Logic
    const scenes = [
      { id: 1, type: "intro", text: `Bem-vindo à aula sobre ${topic}.`, duration: 5 },
      { id: 2, type: "pathophysiology", text: "Aqui vemos o mecanismo principal...", duration: 25 },
      { id: 3, type: "clinical_presentation", text: "O paciente costuma apresentar...", duration: 20 },
      { id: 4, type: "conclusion", text: "Resumindo os pontos chave.", duration: 10 }
    ];

    return jsonResponse({
      success: true,
      topic,
      scenes,
      total_duration: duration_seconds,
      render_ready: true
    });

  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
