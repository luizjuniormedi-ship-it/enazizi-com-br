import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getCerebrasApiKey, 
  listCerebrasModels, 
  callCerebras, 
  logCerebrasRuntime,
  isCerebrasEnabled
} from "../_shared/cerebras-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = getCerebrasApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          provider: "cerebras",
          status: "not_configured",
          enabled: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Listar modelos
    const catalog = await listCerebrasModels();
    
    // 2. Teste real se houver modelos
    const testResults = [];
    if (catalog.ok && catalog.models.length > 0) {
      // Prioridade para gpt-oss-120b se existir, senão pega os primeiros
      const candidates = catalog.models.includes("gpt-oss-120b") 
        ? ["gpt-oss-120b", catalog.models.find(m => m !== "gpt-oss-120b")].filter(Boolean)
        : catalog.models.slice(0, 2);

      for (const modelId of candidates) {
        try {
          const start = Date.now();
          const result = await callCerebras({
            model: modelId as string,
            messages: [{ role: "user", content: "Responda apenas OK." }],
            maxTokens: 10
          });
          
          const latency = Date.now() - start;
          const isValid = result.content.toUpperCase().includes("OK");
          
          testResults.push({
            model: modelId,
            http: 200,
            latencyMs: latency,
            contentValid: isValid,
            status: isValid ? "WORKING" : "DEGRADED"
          });

          // Telemetria
          await logCerebrasRuntime(supabaseClient, {
            taskType: "healthcheck",
            model: modelId as string,
            success: true,
            latencyMs: latency,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            userId: user.id
          });
        } catch (err) {
          testResults.push({
            model: modelId,
            http: (err as any).httpStatus || 500,
            latencyMs: (err as any).latencyMs || 0,
            contentValid: false,
            status: "BROKEN",
            error: (err as any).message
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        provider: "cerebras",
        status: "configured",
        enabled: isCerebrasEnabled(),
        catalog: {
          reachable: catalog.ok,
          count: catalog.models.length,
          models: catalog.models
        },
        tests: testResults,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
