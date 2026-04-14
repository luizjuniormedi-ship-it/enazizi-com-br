/**
 * assistant-log-decision — API Assistente Phase 1
 * Generic endpoint to log any pedagogical decision.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, logDecision,
} from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    const { decisionType, sourceModule, inputSnapshot, decisionOutput, justification, confidenceScore } = body;

    if (!decisionType || !sourceModule) {
      return errorResponse("decisionType and sourceModule are required");
    }

    const db = getServiceClient();

    await logDecision(db, {
      user_id: userId,
      decision_type: decisionType,
      source_module: sourceModule,
      input_snapshot: inputSnapshot ?? {},
      decision_output: decisionOutput ?? {},
      justification: justification ?? "",
      confidence_score: confidenceScore,
    });

    return jsonResponse({ success: true });
  } catch (e) {
    console.error("[assistant-log-decision]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
