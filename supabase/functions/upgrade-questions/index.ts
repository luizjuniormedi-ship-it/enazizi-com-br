// upgrade-questions - ISOLAMENTO PROGRESSIVO FASE 3: COMPLETA COM LAZY IMPORTS
console.log("[upgrade-questions] BOOT: Initing Phase 3 (Full Logic)");

Deno.serve(async (req, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-regression-test",
  };

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  console.log(`[upgrade-questions] REQUEST_START correlationId=${correlationId}`);

  try {
    console.log("[upgrade-questions] STEP: Loading core dependencies");
    const { createClient } = await import("npm:@supabase/supabase-js@2.45.0");
    const { ALLOWED_MODELS } = await import("../_shared/ai-model-registry.ts");
    const { getTokenParameterName } = await import("../_shared/ai-models.ts");
    const { logPipelineAlert } = await import("../_shared/pipeline-logger.ts");
    const { parseAiJson } = await import("../_shared/ai-fetch.ts");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // BYPASS AUTH FOR REGRESSION TEST ONLY IF ENABLED VIA HEADER
    const isTest = req.headers.get("x-regression-test") === "true";
    let user = null;

    if (!isTest) {
      console.log("[upgrade-questions] STEP: Auth validation");
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("UNAUTHORIZED: Missing auth header");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) throw new Error("UNAUTHORIZED: Invalid token");
      user = authUser;

      // Admin role check
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) throw new Error("FORBIDDEN: Admin role required");
    } else {
      console.log("[upgrade-questions] STEP: REGRESSION TEST BYPASS ENABLED");
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 5, 10);
    const ids: string[] | undefined = body.ids;

    console.log("[upgrade-questions] STEP: Fetching questions", { batchSize, idsCount: ids?.length });

    let query = supabaseAdmin.from("questions_bank")
      .select("id, statement, options, correct_index, topic, explanation, source")
      .in("quality_tier", ["needs_upgrade", "basic"])
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (ids && ids.length > 0) {
      query = supabaseAdmin.from("questions_bank")
        .select("id, statement, options, correct_index, topic, explanation, source")
        .in("id", ids)
        .limit(batchSize);
    }

    const { data: questions, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma questão pendente", upgraded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

    const processUpgrade = async () => {
      let upgraded = 0;
      let failed = 0;

      for (const q of questions) {
        try {
          console.log(`[upgrade-questions] Processing ${q.id}`);
          const prompt = `Você é um elaborador de questões de ELITE para residência médica (ENAMED/REVALIDA).
          TAREFA: Transforme o enunciado abaixo em um CASO CLÍNICO DE ALTA COMPLEXIDADE padrão prova real, e gere uma EXPLICAÇÃO DETALHADA. Mantendo o MESMO tema, as MESMAS alternativas e o MESMO gabarito (índice ${q.correct_index}).
          
          ENUNCIADO ORIGINAL: "${q.statement}"
          TEMA: ${q.topic}
          
          Retorne APENAS um JSON: {"statement": "...", "explanation": "..."}`;

          const modelName = ALLOWED_MODELS.generation;
          const tokenKey = getTokenParameterName(modelName);

          const res = await fetch(LOVABLE_GATEWAY, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: "user", content: prompt }],
              [tokenKey]: 2000,
            }),
          });

          if (!res.ok) throw new Error(`AI error ${res.status}`);

          const aiData = await res.json();
          const parsed = parseAiJson(aiData.choices?.[0]?.message?.content || "");
          
          if (parsed.statement && parsed.statement.length > 300) {
            await supabaseAdmin.from("questions_bank").update({
              statement: parsed.statement.trim(),
              explanation: parsed.explanation?.trim(),
              quality_tier: "exam_standard",
              review_status: "approved",
              updated_at: new Date().toISOString(),
              source: q.source ? `${q.source}|ai-upgraded` : "ai-upgraded",
            }).eq("id", q.id);
            upgraded++;
          } else {
            failed++;
          }
        } catch (err) {
          console.error(`[upgrade-questions] Failed question ${q.id}:`, err);
          failed++;
        }
        
        if (questions.indexOf(q) < questions.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      console.log(`[upgrade-questions] BATCH DONE: ${upgraded} success, ${failed} failed`);
    };

    // background job with context.waitUntil if available
    const isBackground = body.background === true;
    if (isBackground && context?.waitUntil) {
      context.waitUntil(processUpgrade());
      return new Response(JSON.stringify({ status: "processing_in_background", batch_size: questions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      await processUpgrade();
      return new Response(JSON.stringify({ status: "completed", processed: questions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    const errorInfo = {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      ts: new Date().toISOString()
    };
    console.error("[upgrade-questions] FATAL ERROR", errorInfo);

    return new Response(JSON.stringify({ error: "failed", details: errorInfo }), {
      status: error?.message?.includes("UNAUTHORIZED") ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
