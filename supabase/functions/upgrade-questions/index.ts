// upgrade-questions - ISOLAMENTO PROGRESSIVO FASE 2: DEPENDECIAS + AUTH
console.log("[upgrade-questions] BOOT: Initing Phase 2 (Dependencies + Auth)");

Deno.serve(async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[upgrade-questions] STEP: Started");

  try {
    // Lazy imports
    console.log("[upgrade-questions] STEP: Loading dependencies");
    const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
    const { ALLOWED_MODELS } = await import("../_shared/ai-model-registry.ts");
    const { getTokenParameterName } = await import("../_shared/ai-models.ts");
    const { logPipelineAlert } = await import("../_shared/pipeline-logger.ts");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[upgrade-questions] STEP: Auth check");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("[upgrade-questions] STEP: Success Auth", { userId: user.id });

    return new Response(JSON.stringify({
      ok: true,
      step: "auth-ok",
      user: user.id,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[upgrade-questions] RUNTIME_ERROR", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });

    return new Response(JSON.stringify({
      error: "runtime_error",
      message: error?.message,
      stack: error?.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
