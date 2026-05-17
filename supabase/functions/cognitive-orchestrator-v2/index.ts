import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const auth = await requireAuth(req);
        if (!auth.ok) return auth.response;
        
        const { userId } = auth;
        const body = await req.json();
        const { context, module } = body;

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

        // Multi-Agent Orchestration
        console.log(`[OrchestratorV2] Invoking orchestration for user ${userId} in module ${module}`);

        // 1. Gather comprehensive state for agents
        const [
            analytics,
            lastErrors,
            fsrsState
        ] = await Promise.all([
            supabase.from("cognitive_analytics").select("*").eq("user_id", userId).maybeSingle(),
            supabase.from("error_bank").select("*").eq("user_id", userId).eq("dominado", false).limit(5),
            supabase.from("fsrs_cards").select("*").eq("user_id", userId).lte("due", new Date().toISOString())
        ]);

        // 2. Specialized Prompts (Supervisor level)
        const supervisorPrompt = `Você é o ENAZIZI Cognitive Orchestrator. 
Sua missão é coordenar Agentes Especializados para otimizar o aprendizado do aluno.

ESTADO DO ALUNO:
- Retenção: ${analytics.data?.overall_retention || 0}%
- Fadiga: ${analytics.data?.fatigue_score || 0}
- Pressão Cognitiva: ${analytics.data?.cognitive_pressure || 0}
- Pendências FSRS: ${fsrsState.data?.length || 0}
- Erros Críticos: ${lastErrors.data?.map(e => e.tema).join(', ') || 'Nenhum'}

CONTEXTO ATUAL:
${JSON.stringify(context)}

DECIDA:
1. Qual agente supervisor deve assumir? (Tutor, Planner, Recovery)
2. Há risco de alucinação ou drift?
3. Nível de profundidade necessário (1-5).
4. Resposta estruturada JSON.`;

        const aiRes = await aiFetch({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "system", content: supervisorPrompt }, { role: "user", content: "Determine next cognitive action." }],
            userId
        });

        const decision = await aiRes.json();
        
        // Log outcome for F9/F10 logic (closing loop)
        await supabase.from("orchestrator_decisions").insert({
            user_id: userId,
            decision_type: "agent_orchestration",
            decision_output: decision,
            input_snapshot: { analytics: analytics.data, module }
        });

        return new Response(JSON.stringify({
            ok: true,
            decision: decision.choices?.[0]?.message?.content,
            requestId: crypto.randomUUID()
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
