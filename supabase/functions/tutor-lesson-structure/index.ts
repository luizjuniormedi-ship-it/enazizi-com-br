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
const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes timeout threshold for UI

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
  gemini_video_prompt?: string;
  google_vids_prompt?: string;
};

Deno.serve(async (req) => {
  try {
    console.log("Tutor Lesson Structure v2.2 (Armored)");
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

    try {
      const result = await callAIWithFallback(lovableKey, lesson, ctx);
      structured = result.data;
      modelUsed = result.model;
      fallbackUsed = result.fallbackUsed;
      gatewayStatus = result.status;
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
      title: structured.title || lesson.title || "Aula sem título",
      subtitle: structured.subtitle || lesson.subtitle || null,
      summary: buildSummary(structured),
      estimated_duration_minutes: structured.estimated_duration_minutes ?? null,
      structured_content: structured as unknown as Record<string, unknown>,
      pedagogical_quality_score: score,
      last_structuring_error: null,
      last_structuring_at: new Date().toISOString(),
      notebooklm_export: structured.notebooklm_prompt || null,
      gemini_export: structured.gemini_video_prompt || null,
      google_vids_export: structured.google_vids_prompt || null,
      cinematic_prompt: { 
        gemini: structured.gemini_video_prompt, 
        google_vids: structured.google_vids_prompt 
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
        finished_at: new Date().toISOString()
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
      topic_preserved: true
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
  
  // 1) DB Access Check
  const { data: dbCheck, error: dbError } = await admin.from("tutor_lesson_memory").select("id").limit(1);
  checks.push({ name: "DB_ACCESS", ok: !dbError, error: dbError?.message });

  // 2) Tables check
  const { error: eventTableError } = await admin.from("tutor_lesson_events").select("id").limit(1);
  checks.push({ name: "tutor_lesson_events", ok: !eventTableError, error: eventTableError?.message });

  // 3) Env Vars check
  checks.push({ name: "SUPABASE_URL", ok: !!Deno.env.get("SUPABASE_URL") });
  checks.push({ name: "SERVICE_ROLE", ok: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") });
  checks.push({ name: "LOVABLE_API_KEY", ok: !!lovableKey });

  // 4) AI Gateway check (Simple POST test)
  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1
      })
    });
    checks.push({ name: "Lovable AI Gateway", ok: aiResp.ok, status: aiResp.status });
  } catch (e) {
    checks.push({ name: "AI Gateway Reachability", ok: false, error: (e as Error).message });
  }


  // 5) Stuck Lessons Check
  const timeoutThreshold = new Date(Date.now() - TIMEOUT_MS).toISOString();
  const { count: stuckCount } = await admin
    .from("tutor_lesson_memory")
    .select("id", { count: "exact", head: true })
    .eq("status", "structuring")
    .lt("last_structuring_at", timeoutThreshold);
  
  checks.push({ 
    name: "NO_STUCK_LESSONS", 
    ok: (stuckCount ?? 0) === 0, 
    detail: `${stuckCount} stuck` 
  });

  return json({
    success: true,
    ok: checks.every(c => c.ok || c.name === "NO_STUCK_LESSONS"), // Stuck lessons don't necessarily mean the service is down
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(checks.map(c => [c.name, c.ok]))
  });
}


async function logEvent(admin: any, lessonId: string, actorId: string, eventType: string, metadata: any) {
  return await admin.from("tutor_lesson_events").insert([{
    lesson_id: lessonId,
    actor_id: actorId,
    event_type: eventType,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString()
    }
  }]);
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
        gemini_video_prompt: { type: "string" },
        google_vids_prompt: { type: "string" },
      },
      required: ["title", "chapters", "video_script", "notebooklm_prompt"],
    },
  },
};

async function callAIWithFallback(apiKey: string, lesson: any, ctx: Record<string, unknown>) {
  const models = ["openai/gpt-4o-mini", "openai/gpt-4o"];
  let lastError = "";
  let lastStatus: number | null = null;
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const result = await callAI(apiKey, lesson, ctx, model);
      if (result.data) return { data: result.data, model, fallbackUsed: i > 0, status: result.status };
    } catch (e) {
      lastError = (e as Error).message;
      lastStatus = (e as any).status || 500;
      // If rate limited, don't fallback immediately, maybe it's global
      if (lastStatus === 429) throw e;
    }
  }
  
  throw new Error(lastError || "AI failed all models");
}

async function callAI(apiKey: string, lesson: any, ctx: Record<string, unknown>, model: string): Promise<{ data: StructuredLesson | null, status: number }> {
  const systemPrompt = `Você é um professor especialista da plataforma ENAZIZI/ENAFLIX. pt-BR.
Regra de Ouro: Preserve o tema médico original "${lesson.topic}".
Se você sugerir algo mais específico, o sistema salvará como sugestão, mas o tema principal não será alterado.`;

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
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let parsed = null;
  try {
    if (args) parsed = JSON.parse(args);
  } catch (e) {
    console.error("Failed to parse tool arguments:", e, "Raw:", args);
  }
  return { data: parsed, status: resp.status };
}

function computeQualityScore(s: StructuredLesson): number {
  let score = 0;
  if (s.title) score += 20;
  if (s.learning_objectives?.length) score += 20;
  if (s.chapters && s.chapters.length >= 2) score += 30;
  if (s.video_script?.narration) score += 30;
  return score;
}

function buildSummary(s: StructuredLesson): string {
  return s.lay_explanation || s.technical_explanation || s.title || "";
}


