
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, getServiceClient, jsonResponse, errorResponse } from "../_shared/assistant-helpers.ts";

/**
 * Quality Lock Validator
 * 
 * Gatekeeper for AI-generated content. Audits depth, hallucinations, 
 * and pedagogical coherence using a "Supervisor" model.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const { content_type, content_id, content_payload } = await req.json();

    if (!content_id || !content_type || !content_payload) {
      return errorResponse("Missing required audit fields.");
    }

    // Call AI Gateway for audit (using a high-reasoning model like Gemini 2.0 Pro or Claude 3.5 Sonnet)
    const aiGatewayUrl = Deno.env.get("LOVABLE_AI_GATEWAY_URL") || "https://ai-gateway.lovable.dev/v1/chat/completions";
    const aiKey = Deno.env.get("LOVABLE_API_KEY");

    const auditPrompt = `
      Você é um Especialista em Educação Médica (Pedagogical Auditor).
      Analise o seguinte conteúdo gerado para um aluno de medicina (Tipo: ${content_type}):
      
      ${JSON.stringify(content_payload, null, 2)}
      
      CRITÉRIOS DE AUDITORIA:
      1. Profundidade: O conteúdo é adequado para nível médico ou é superficial?
      2. Alucinação: Há termos médicos inventados ou correlações clínicas impossíveis?
      3. Coerência: A explicação faz sentido lógico e segue guidelines atuais?
      4. Formato: Segue os padrões técnicos do sistema?
      
      Responda em JSON:
      {
        "valid_pedagogical_depth": boolean,
        "hallucination_check": boolean (true se estiver OK),
        "coherence_score": number (0-1),
        "audit_notes": "string",
        "action": "approve" | "reject" | "flag"
      }
    `;

    const auditRes = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${aiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp", // Example of a good reasoning model
        messages: [{ role: "user", content: auditPrompt }],
        response_format: { type: "json_object" }
      })
    });

    const auditData = await auditRes.json();
    const result = JSON.parse(auditData.choices[0].message.content);

    // 2. Persist Audit Result
    const { error: insertErr } = await supabase
      .from("quality_lock_validations")
      .insert({
        content_type,
        content_id,
        valid_pedagogical_depth: result.valid_pedagogical_depth,
        hallucination_check: result.hallucination_check,
        coherence_score: result.coherence_score,
        audit_notes: result.audit_notes,
        auditor_model: "gemini-2.0-flash-pedagogical-v1"
      });

    if (insertErr) throw insertErr;

    return jsonResponse({
      success: true,
      audit_result: result,
      content_id
    });

  } catch (error) {
    console.error("[QualityLock] Error:", error);
    return errorResponse(error.message, 500);
  }
});
