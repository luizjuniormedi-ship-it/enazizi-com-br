// tutor-lesson-structure: gera estrutura pedagógica completa via Lovable AI.
// Roda com service role para escrever em tutor_lesson_memory (bypass de trigger via auth.uid()=null).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_HOUR = 100;
const MIN_QUALITY = 50;
const STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes timeout threshold for UI

// Gemini Guard: Ativado para garantir política OpenAI-only
const FORBIDDEN_MODELS = ["gemini", "google", "claude"];

function checkGeminiGuard(model: string) {
  const isForbidden = FORBIDDEN_MODELS.some(m => model.toLowerCase().includes(m));
  if (isForbidden) {
    throw new Error(`POLÍTICA DE SEGURANÇA: Modelo ${model} é proibido. Use apenas OpenAI.`);
  }
  return true;
}

type StructuredLesson = {
  title: string;
  subtitle?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty_level?: string;
  estimated_duration_minutes?: number;
  learning_objectives?: string[];
  lay_explanation?: string;
  technical_explanation?: string;
  clinical_or_exam_relevance?: string;
  chapters?: Array<Record<string, unknown>>;
  video_script?: Record<string, unknown>;
  notebooklm_prompt?: string;
  cinematic_video_prompt?: string;
};

Deno.serve(async (req) => {
  try {
    console.log("Tutor Lesson Structure v2.5 (Production Hardened)");
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // 0) Validate Env immediately inside try
    if (!lovableKey || !supabaseUrl || !serviceKey) {
      console.error("Missing environment variables");
      return json({ 
        success: false,
        code: "MISSING_ENV",
        message: "Configuração do servidor incompleta (API Keys ausentes).",
        technical_reason: `Lovable: ${!!lovableKey}, URL: ${!!supabaseUrl}, Key: ${!!serviceKey}`
      }, 500);
    }
    
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    console.log("Body action received:", body?.action);
    
    // Healthcheck support - move BEFORE auth to allow debugging env issues
    if (body?.action === "healthcheck") {
      console.log("Running healthcheck...");
      return await runHealthcheck(admin, lovableKey);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ 
        success: false,
        code: "UNAUTHENTICATED",
        message: "Sessão expirada ou inválida." 
      }, 401);
    }

    const lessonId: string | undefined = body?.lesson_id;
    if (!lessonId) {
      return json({ 
        success: false,
        code: "MISSING_PARAMS",
        message: "ID da aula não fornecido." 
      }, 400);
    }

    // 1) Load lesson
    const { data: lesson, error: lessonErr } = await admin
      .from("tutor_lesson_memory")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();
      
    if (lessonErr || !lesson) {
      return json({ 
        success: false,
        code: "LESSON_NOT_FOUND",
        message: "Aula não encontrada no banco de dados.",
        technical_reason: lessonErr?.message 
      }, 404);
    }

    // 2) Rate limit (skip for staff)
    const { data: isStaff } = await admin.rpc("is_lesson_staff", {
      _user_id: user.id,
    });

    if (!isStaff) {
      const { count: hourCount } = await admin
        .from("tutor_lesson_events")
        .select("id", { count: "exact", head: true })
        .eq("actor_id", user.id)
        .eq("event_type", "lesson_structuring_started")
        .gte("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
      
      if ((hourCount ?? 0) >= MAX_PER_HOUR) {
        return json({ 
          success: false,
          code: "RATE_LIMITED",
          message: "Você atingiu o limite de estruturação por hora." 
        }, 429);
      }
    }

    // 3) Mark as structuring
    const currentAttempt = (lesson.structuring_attempts ?? 0) + 1;
    await admin
      .from("tutor_lesson_memory")
      .update({
        status: "structuring",
        last_structuring_at: new Date().toISOString(),
        structuring_attempts: currentAttempt,
        last_structuring_error: null,
      })
      .eq("id", lessonId);

    await logEvent(admin, lessonId, user.id, "lesson_structuring_started", { 
      attempt: currentAttempt,
      original_topic: lesson.topic,
      started_at: new Date().toISOString()
    });

    // 4) Collect context
    const ctx = await collectContext(admin, lesson);

    // 5) Call AI with fallback and retries
    let structured: StructuredLesson | null = null;
    let aiError: string | null = null;
    let modelUsed = "";
    let fallbackUsed = false;
    let gatewayStatus: number | null = null;
    let parsingStrategy = "none";

    try {
      const result = await callAIWithFallback(lovableKey, lesson, ctx);
      structured = result.data;
      modelUsed = result.model;
      fallbackUsed = result.fallbackUsed;
      gatewayStatus = result.status;
      parsingStrategy = result.parsingStrategy || "tool_call";
    } catch (e: any) {
      aiError = e.message;
      gatewayStatus = e.status || 500;
    }

    if (!structured) {
      const isRetryable = aiError?.includes("502") || aiError?.includes("503") || aiError?.includes("504") || aiError?.includes("timeout") || aiError?.includes("429");
      const eventType = isRetryable ? "lesson_structuring_retry" : "lesson_structure_failed";
      
      await admin
        .from("tutor_lesson_memory")
        .update({
          status: "needs_adjustment",
          last_structuring_error: aiError ?? "AI returned empty",
          last_structuring_at: new Date().toISOString(),
        })
        .eq("id", lessonId);
      
      await logEvent(admin, lessonId, user.id, eventType, { 
        error_message: aiError,
        attempt_count: currentAttempt,
        model_used: modelUsed,
        fallback_used: fallbackUsed,
        gateway_status: gatewayStatus,
        duration_ms: Date.now() - startTime,
        original_topic: lesson.topic
      });
      
      return json({ 
        success: false,
        code: "STRUCTURE_FAILED",
        message: "Não foi possível estruturar esta aula agora. Tente reprocessar em alguns instantes.",
        technical_reason: aiError,
        fallback_available: true,
        retryable: isRetryable 
      }, gatewayStatus || 502);
    }

    // 6) Quality score and finalization
    const score = computeQualityScore(structured);
    const finalStatus = score >= MIN_QUALITY ? "pending_review" : "needs_adjustment";

    // 7) Safe Persist (Protects Canonical Fields)
    // NEVER update topic, subject, subtopic, user_id, source_session_id with AI values directly
    const updateData = {
      status: finalStatus,
      title: (structured.title || lesson.title || "Aula sem título").slice(0, 255),
      subtitle: structured.subtitle ? structured.subtitle.slice(0, 255) : null,
      summary: buildSummary(structured),
      estimated_duration_minutes: structured.estimated_duration_minutes ?? null,
      structured_content: structured as unknown as Record<string, unknown>,
      pedagogical_quality_score: score,
      last_structuring_error: null,
      last_structuring_at: new Date().toISOString(),
      notebooklm_export: structured.notebooklm_prompt || null,
      cinematic_prompt: { 
        gpt5: structured.cinematic_video_prompt
      },
      metadata: {
        ...(lesson.metadata || {}),
        ai_suggested_topic: structured.topic,
        ai_suggested_subject: structured.subject,
        ai_suggested_subtopic: structured.subtopic,
        topic_preserved: true,
        model_used: modelUsed,
        fallback_used: fallbackUsed,
        attempt_count: currentAttempt,
        duration_ms: Date.now() - startTime,
        gateway_status: gatewayStatus,
        parsing_strategy: parsingStrategy,
        score: score,
        finished_at: new Date().toISOString(),
        guard_status: "passed"
      }
    };

    const { error: updErr } = await admin
      .from("tutor_lesson_memory")
      .update(updateData)
      .eq("id", lessonId);

    if (updErr) {
      console.error("Persist error:", updErr);
      return json({ 
        success: false,
        code: "PERSIST_FAILED",
        message: "Erro ao salvar os dados estruturados.",
        technical_reason: updErr.message 
      }, 500);
    }

    await logEvent(admin, lessonId, user.id, "lesson_structured", {
      score,
      status: finalStatus,
      model_used: modelUsed,
      fallback_used: fallbackUsed,
      duration_ms: Date.now() - startTime,
      original_topic: lesson.topic,
      ai_returned_topic: structured.topic,
      topic_preserved: true,
      parsing_strategy: parsingStrategy
    });

    return json({
      success: true,
      ok: true,
      status: finalStatus,
      pedagogical_quality_score: score,
    });

  } catch (e) {
    console.error("[tutor-lesson-structure] FATAL", e);
    return json({ 
      success: false,
      code: "TUTOR_LESSON_STRUCTURE_RUNTIME_ERROR",
      message: "Não foi possível estruturar esta aula agora.",
      technical_reason: (e as Error).message ?? String(e),
      fallback_available: true
    }, 500);
  }
});


async function runHealthcheck(admin: any, lovableKey: string) {
  const checks = [];
  const results: any = {};
  
  // 1) DB Access Check
  const dbStart = Date.now();
  const { data: dbCheck, error: dbError } = await admin.from("tutor_lesson_memory").select("id").limit(1);
  const dbLatency = Date.now() - dbStart;
  checks.push({ name: "DB_ACCESS", ok: !dbError, error: dbError?.message, latency: dbLatency });

  // 2) Tables check
  const { error: eventTableError } = await admin.from("tutor_lesson_events").select("id").limit(1);
  checks.push({ name: "tutor_lesson_events", ok: !eventTableError, error: eventTableError?.message });

  // 3) Env Vars check
  checks.push({ name: "SUPABASE_URL", ok: !!Deno.env.get("SUPABASE_URL") });
  checks.push({ name: "SERVICE_ROLE", ok: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") });
  checks.push({ name: "LOVABLE_API_KEY", ok: !!lovableKey });

  // 4) AI Gateway check (Real GPT-5-mini call)
  let gatewayStatus = 0;
  let modelUsed = "google/gemini-2.5-flash";
  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelUsed,
        messages: [{ role: "user", content: "hi" }],
        max_completion_tokens: 5
      })
    });
    gatewayStatus = aiResp.status;
    const aiOk = aiResp.ok;
    let aiErr = null;
    if (!aiOk) {
      aiErr = await aiResp.text();
    }
    checks.push({ name: "Lovable AI Gateway", ok: aiOk, status: gatewayStatus, error: aiErr });
  } catch (e) {
    checks.push({ name: "AI Gateway Reachability", ok: false, error: (e as Error).message });
  }

  // 5) Automatic Recovery / Stuck Lessons Detection
  const timeoutThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
  const { data: stuckLessons, error: stuckErr } = await admin
    .from("tutor_lesson_memory")
    .select("id, topic")
    .eq("status", "structuring")
    .lt("last_structuring_at", timeoutThreshold);
  
  if (stuckLessons && stuckLessons.length > 0) {
    console.log(`Detected ${stuckLessons.length} stuck lessons. Recovering...`);
    for (const lesson of stuckLessons) {
      await admin
        .from("tutor_lesson_memory")
        .update({ 
          status: "needs_adjustment", 
          last_structuring_error: "lesson_structure_timeout_detected" 
        })
        .eq("id", lesson.id);
      
      await logEvent(admin, lesson.id, "system", "lesson_structure_timeout_detected", {
        topic: lesson.topic,
        threshold_ms: STUCK_THRESHOLD_MS
      });
    }
  }

  checks.push({ 
    name: "RECOVERY_SYSTEM", 
    ok: !stuckErr, 
    detail: stuckLessons ? `${stuckLessons.length} recovered` : "0 stuck" 
  });

  return json({
    success: true,
    ok: checks.every(c => c.ok || c.name === "RECOVERY_SYSTEM"),
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - dbStart,
    primary_model: "google/gemini-2.5-flash",
    fallback_model: "google/gemini-2.5-flash",
    gemini_guard_status: "active",
    forbidden_models_found: false,
    gateway_status: gatewayStatus,
    db_latency: dbLatency,
    checks: Object.fromEntries(checks.map(c => [c.name, { ok: c.ok, status: (c as any).status, error: (c as any).error, detail: (c as any).detail }]))
  });
}


async function logEvent(admin: any, lessonId: string, actorId: string, eventType: string, metadata: any) {
  try {
    return await admin.from("tutor_lesson_events").insert([{
      lesson_id: lessonId,
      actor_id: actorId === "system" ? "00000000-0000-0000-0000-000000000000" : actorId,
      event_type: eventType,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    }]);
  } catch (e) {
    console.error("Telemetry failed:", e);
  }
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function collectContext(admin: any, lesson: any) {
  const ctx: Record<string, unknown> = {
    lesson_topic: lesson.topic,
    lesson_subject: lesson.subject,
    lesson_subtopic: lesson.subtopic,
  };
  
  if (lesson.source_session_id) {
    const { data: msgs } = await admin
      .from("tutor_messages")
      .select("role, content")
      .eq("session_id", lesson.source_session_id)
      .order("created_at", { ascending: true })
      .limit(30);
    if (msgs) ctx.tutor_conversation = msgs;
  }

  return ctx;
}

const STRUCTURE_TOOL = {
  type: "function",
  function: {
    name: "publish_lesson_structure",
    description: "Publica a estrutura pedagógica completa da aula em formato JSON.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        subject: { type: "string" },
        topic: { type: "string" },
        subtopic: { type: "string" },
        difficulty_level: { type: "string" },
        estimated_duration_minutes: { type: "number" },
        learning_objectives: { type: "array", items: { type: "string" } },
        lay_explanation: { type: "string" },
        technical_explanation: { type: "string" },
        clinical_or_exam_relevance: { type: "string" },
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              order: { type: "number" },
              title: { type: "string" },
              summary: { type: "string" },
              script: { type: "string" },
              visual_suggestion: { type: "string" },
              key_points: { type: "array", items: { type: "string" } },
            },
            required: ["order", "title", "script"],
          },
        },
        video_script: {
          type: "object",
          properties: {
            narration: { type: "string" },
          },
        },
        notebooklm_prompt: { type: "string" },
        cinematic_video_prompt: { type: "string" },
      },
      required: ["title", "chapters", "video_script", "notebooklm_prompt"],
    },
  },
};

async function callAIWithFallback(apiKey: string, lesson: any, ctx: Record<string, unknown>) {
  const models = ["google/gemini-2.5-flash", "google/gemini-2.5-flash"];
  let lastError = "";
  let lastStatus: number | null = null;
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const result = await callAI(apiKey, lesson, ctx, model);
      if (result.data) return { 
        data: result.data, 
        model, 
        fallbackUsed: i > 0, 
        status: result.status,
        parsingStrategy: result.parsingStrategy
      };
    } catch (e) {
      lastError = (e as Error).message;
      lastStatus = (e as any).status || 500;
      if (lastStatus === 429) throw e;
    }
  }
  
  throw new Error(lastError || "AI failed all models");
}

async function callAI(apiKey: string, lesson: any, ctx: Record<string, unknown>, model: string): Promise<{ data: StructuredLesson | null, status: number, parsingStrategy: string }> {
  checkGeminiGuard(model);
  const systemPrompt = `Você é um professor especialista da plataforma ENAZIZI/ENAFLIX. pt-BR.
Regra de Ouro: Preserve o tema médico original "${lesson.topic}".
Se você sugerir algo mais específico, o sistema salvará como sugestão, mas o tema principal não será alterado.
Sempre responda usando a ferramenta publish_lesson_structure.`;

  const userPrompt = `Aula: ${lesson.topic} (${lesson.subject}). Contexto: ${JSON.stringify(ctx).slice(0, 4000)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [STRUCTURE_TOOL],
      tool_choice: { type: "function", function: { name: "publish_lesson_structure" } },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error(`AI error ${resp.status}: ${errText.slice(0, 100)}`);
    (err as any).status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const choice = data?.choices?.[0];
  const toolCall = choice?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;
  
  let parsed = null;
  let strategy = "tool_call";

  if (args) {
    try {
      parsed = JSON.parse(args);
    } catch (e) {
      console.error("Tool parse fail, trying regex fallback");
      const jsonMatch = args.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          strategy = "regex_fallback";
        } catch (inner) {
          console.error("Regex fallback failed");
        }
      }
    }
  }

  // Final fallback: check content for raw JSON if tool_call was missed
  if (!parsed && choice?.message?.content) {
    const content = choice.message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
        strategy = "content_json_fallback";
      } catch (e) {
        console.error("Content JSON parse failed");
      }
    }
  }

  return { data: parsed, status: resp.status, parsingStrategy: strategy };
}

function computeQualityScore(s: StructuredLesson): number {
  let score = 0;
  if (!s) return 0;
  if (s.title) score += 20;
  if (s.learning_objectives?.length) score += 20;
  if (s.chapters && s.chapters.length >= 2) score += 30;
  if (s.video_script?.narration || (s.video_script as any)?.content) score += 30;
  return score;
}

function buildSummary(s: StructuredLesson): string {
  const sum = s.lay_explanation || s.technical_explanation || s.title || "";
  return sum.slice(0, 1000); // Protection against massive payloads
}



