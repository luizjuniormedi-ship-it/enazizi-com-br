import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, topic, ai_response, student_message } = await req.json();

    if (!ai_response) throw new Error("ai_response is required");

    // 1. Quality Validation via LLM (Pedagogical Guardrail)
    const validationResponse = await aiFetch({
      model: "google/gemini-2.5-flash", // Use a cheaper/faster model for validation
      messages: [
        {
          role: "system",
          content: `Você é um Supervisor Pedagógico Sênior do ENAZIZI. Avalie se a resposta da IA para o estudante de medicina é correta, profunda e segue as diretrizes clínicas.
          
          DIRETRIZES:
          - Precisão clínica absoluta.
          - Didática médica (Harrison/Robbins).
          - Sem alucinações.
          - Coerência com o tema: ${topic}.
          
          Responda em JSON:
          {
            "quality_score": 0-10,
            "hallucination_detected": boolean,
            "depth_score": 0-10,
            "clinical_error": boolean,
            "reasons": ["...", "..."],
            "should_regenerate": boolean
          }`
        },
        {
          role: "user",
          content: `Mensagem do Aluno: ${student_message}\nResposta da IA: ${ai_response}`
        }
      ]
    });

    if (!validationResponse.ok) throw new Error("Validation AI failed");

    const validationResult = await validationResponse.json();
    const result = JSON.parse(validationResult.choices[0].message.content);

    // 2. Log Quality Metadata
    await supabase.from("tutor_effectiveness").insert({
      user_id,
      pedagogical_impact_score: result.quality_score,
      average_depth_score: result.depth_score,
      hallucination_detected: result.hallucination_detected,
      metadata: { ...result, topic, student_message }
    });

    // 3. Trigger Self-Healing if quality is critical
    if (result.should_regenerate || result.hallucination_detected || result.quality_score < 4) {
      await supabase.from("self_healing_incidents").insert({
        feature_name: "Tutor Supervisor",
        incident_type: result.hallucination_detected ? "hallucination" : "low_quality",
        severity: "medium",
        symptoms: result,
        metadata: { user_id, topic }
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
