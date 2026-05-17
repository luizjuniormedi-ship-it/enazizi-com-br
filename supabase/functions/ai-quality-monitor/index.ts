/**
 * AI Quality Monitor v2026
 * 
 * Scans recent AI responses for pedagogical drift, superficiality, 
 * or potential hallucinations using a secondary "Guardian" agent.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

        // 1. Fetch recent responses to audit
        const { data: messages } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(5);

        if (!messages || messages.length === 0) {
            return new Response(JSON.stringify({ ok: true, message: "No messages to audit" }));
        }

        // 2. Audit loop (Using Guardian Prompt)
        const GUARDIAN_PROMPT = `Você é o ENAZIZI Guardian Agent.
Sua missão é auditar a qualidade de uma resposta médica dada por outra IA.
Critérios de REPROVAÇÃO:
- Resposta superficial ("chatbot comum").
- Falta de embasamento em guidelines.
- Erro técnico evidente.
- Tom não-pedagógico.
- Alucinação de conduta.

Responda em JSON: { "score": 0-100, "hallucination": boolean, "feedback": "texto" }`;

        for (const msg of messages) {
            const auditRes = await aiFetch({
                model: "openai/gpt-4o-mini", // Use smaller/faster model for auditing
                messages: [
                    { role: "system", content: GUARDIAN_PROMPT },
                    { role: "user", content: `AUDITAR ESTA RESPOSTA:\n\n${msg.content}` }
                ],
                jsonResponse: true
            });

            const auditData = await auditRes.json();
            const result = JSON.parse(auditData.choices[0].message.content);

            // 3. Log results
            await supabase.from("ai_governance_logs").insert({
                function_name: "guardian-audit",
                model_name: "google/gemini-2.5-flash",
                incident_type: result.hallucination ? "hallucination" : "audit_report",
                severity: result.score < 60 ? "critical" : "info",
                details: {
                    messageId: msg.id,
                    score: result.score,
                    feedback: result.feedback
                },
                audited_at: new Date().toISOString()
            });
        }

        return new Response(JSON.stringify({ success: true, audited: messages.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (e) {
        console.error("[QualityMonitor] Fatal:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
