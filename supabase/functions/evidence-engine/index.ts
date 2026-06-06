import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseAIJson(raw: string): Record<string, unknown> {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(cleaned);
}

const EVIDENCE_ENGINE_PROMPT = `Você é o EVIDENCE ENGINE ENAZIZI V6.
Sua missão é quantificar a eficácia pedagógica da plataforma através de 3 camadas críticas:

1. LEARNING YIELD: Capacidade de converter erro em acerto após intervenção.
2. TRANSFER SCORE: Capacidade de aplicar o conhecimento em contextos diferentes (Questão -> Caso -> OSCE).
3. RETENTION LIFT: Ganho de memória em relação ao grupo controle.

Analise os dados do usuário e retorne um relatório científico.

Responda OBRIGATORIAMENTE em JSON:
{
  "learning_yield": number,
  "transfer_score": number,
  "retention_lift": {
    "d7": number,
    "d30": number,
    "d90": number
  },
  "false_positive_rate": number,
  "false_negative_rate": number,
  "scientific_conclusion": "string",
  "audit_recommendation": "string"
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user, ok, response } = await requireAuth(req);
    if (!ok) return response;

    const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Buscar dados para o motor: Erros vs Recuperações vs Acertos posteriores
    const [errors, recoveries, attempts] = await Promise.all([
      supabaseService.from('hospital_errors_v2').select('*').eq('user_id', user.id),
      supabaseService.from('pedagogical_recovery_tracking').select('*').eq('user_id', user.id),
      supabaseService.from('practice_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
    ]);

    const messages = [
      { role: "system", content: EVIDENCE_ENGINE_PROMPT },
      { role: "user", content: `Dados Pedagógicos:
        Erros Cometidos: ${JSON.stringify(errors.data?.length)}
        Recuperações Iniciadas: ${JSON.stringify(recoveries.data?.length)}
        Últimos Tentativas: ${JSON.stringify(attempts.data?.slice(0, 50))}
      ` }
    ];

    const aiResp = await aiFetch({
      model: "google/gemini-2.0-flash-001",
      messages,
      timeoutMs: 60000,
    });

    if (!aiResp.ok) throw new Error("Erro na IA");

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
    const parsed = safeParseAIJson(raw);

    // Salvar métricas de evidência
    await supabaseService.from('pedagogical_evidence_metrics').upsert({
      user_id: user.id,
      learning_yield_score: parsed.learning_yield,
      transfer_score: parsed.transfer_score,
      retention_d30: parsed.retention_lift.d30,
      retention_d90: parsed.retention_lift.d90,
      false_positive_rate: parsed.false_positive_rate,
      false_negative_rate: parsed.false_negative_rate,
      audit_log: [parsed.scientific_conclusion, parsed.audit_recommendation]
    });

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
  }
});
