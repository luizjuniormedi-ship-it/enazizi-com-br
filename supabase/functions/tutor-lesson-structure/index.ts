// tutor-lesson-structure: gera estrutura pedagógica completa via Lovable AI.
// Roda com service role para escrever em tutor_lesson_memory (bypass de trigger via auth.uid()=null).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_HOUR = 100;
const MAX_PER_DAY = 500;
const MIN_QUALITY = 50;

type StructuredLesson = {
  title: string;
  subtitle?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty_level?: string;
  estimated_duration_minutes?: number;
  student_context?: Record<string, unknown>;
  learning_objectives?: string[];
  lay_explanation?: string;
  technical_explanation?: string;
  clinical_or_exam_relevance?: string;
  chapters?: Array<Record<string, unknown>>;
  key_concepts?: string[];
  common_mistakes?: string[];
  exam_traps?: string[];
  quick_review?: string;
  flashcard_suggestions?: Array<Record<string, unknown>>;
  quiz_questions?: Array<Record<string, unknown>>;
  video_script?: Record<string, unknown>;
  notebooklm_prompt?: string;
  gemini_video_prompt?: string;
  google_vids_prompt?: string;
  references?: string[];
  quality_notes?: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    
    // Healthcheck support
    if (body?.action === "healthcheck") {
      return await runHealthcheck(admin, lovableKey);
    }

    const lessonId: string | undefined = body?.lesson_id;
    if (!lessonId) return json({ error: "lesson_id required" }, 400);

    // 1) Load lesson
    const { data: lesson, error: lessonErr } = await admin
      .from("tutor_lesson_memory")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();
      
    if (lessonErr || !lesson) {
      return json({ error: "lesson_not_found" }, 404);
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
        return json({ error: "rate_limited", message: "Limite por hora atingido." }, 429);
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
      original_topic: lesson.topic 
    });

    // 4) Collect context
    const ctx = await collectContext(admin, lesson);

    // 5) Call AI with fallback and retries
    let structured: StructuredLesson | null = null;
    let aiError: string | null = null;
    let modelUsed = "";
    let fallbackUsed = false;

    try {
      const result = await callAIWithFallback(lovableKey, lesson, ctx);
      structured = result.data;
      modelUsed = result.model;
      fallbackUsed = result.fallbackUsed;
    } catch (e) {
      aiError = (e as Error).message;
    }

    if (!structured) {
      await admin
        .from("tutor_lesson_memory")
        .update({
          status: "needs_adjustment",
          last_structuring_error: aiError ?? "AI returned empty",
        })
        .eq("id", lessonId);
      
      await logEvent(admin, lessonId, user.id, "lesson_structure_failed", { 
        error: aiError,
        attempt: currentAttempt,
        model_used: modelUsed,
        fallback_used: fallbackUsed
      });
      
      return json({ error: "ai_failed", detail: aiError }, 502);
    }

    // 6) Quality score and finalization
    const score = computeQualityScore(structured);
    const finalStatus = score >= MIN_QUALITY ? "pending_review" : "needs_adjustment";

    // 7) Safe Persist (Protects Canonical Fields)
    const updateData = {
      status: finalStatus,
      title: structured.title || lesson.title || "Aula sem título",
      subtitle: structured.subtitle || lesson.subtitle || null,
      summary: buildSummary(structured),
      estimated_duration_minutes: structured.estimated_duration_minutes ?? null,
      structured_content: structured as unknown as Record<string, unknown>,
      pedagogical_quality_score: score,
      last_structuring_error: null,
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
        duration_ms: Date.now() - startTime
      }
    };

    const { error: updErr } = await admin
      .from("tutor_lesson_memory")
      .update(updateData)
      .eq("id", lessonId);

    if (updErr) {
      console.error("Persist error:", updErr);
      return json({ error: "persist_failed", detail: updErr.message }, 500);
    }

    await logEvent(admin, lessonId, user.id, "lesson_structured", {
      score,
      status: finalStatus,
      chapters: structured.chapters?.length ?? 0,
      model_used: modelUsed,
      fallback_used: fallbackUsed,
      duration_ms: Date.now() - startTime
    });

    return json({
      ok: true,
      status: finalStatus,
      pedagogical_quality_score: score,
    });

  } catch (e) {
    console.error("Global structure error:", e);
    return json({ error: "internal", detail: (e as Error).message }, 500);
  }
});

async function runHealthcheck(admin: any, lovableKey: string) {
  const checks = [];
  
  // Check DB
  const { data: dbCheck, error: dbError } = await admin.from("tutor_lesson_memory").select("id").limit(1);
  checks.push({ name: "database", ok: !dbError, error: dbError?.message });

  // Check AI Gateway
  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/models", {
      headers: { Authorization: `Bearer ${lovableKey}` }
    });
    checks.push({ name: "ai_gateway", ok: aiResp.ok, status: aiResp.status });
  } catch (e) {
    checks.push({ name: "ai_gateway", ok: false, error: (e as Error).message });
  }

  return json({
    ok: checks.every(c => c.ok),
    timestamp: new Date().toISOString(),
    checks
  });
}

async function logEvent(admin: any, lessonId: string, actorId: string, eventType: string, metadata: any) {
  return await admin.from("tutor_lesson_events").insert([{
    lesson_id: lessonId,
    actor_id: actorId,
    event_type: eventType,
    metadata
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
  const models = ["google/gemini-2.5-pro", "google/gemini-2.5-flash"];
  let lastError = "";
  
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const data = await callAI(apiKey, lesson, ctx, model);
      if (data) return { data, model, fallbackUsed: i > 0 };
    } catch (e) {
      lastError = (e as Error).message;
      if (lastError.includes("rate-limited")) throw e;
    }
  }
  
  throw new Error(lastError || "AI failed all models");
}

async function callAI(apiKey: string, lesson: any, ctx: Record<string, unknown>, model: string): Promise<StructuredLesson | null> {
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
    if (resp.status === 429) throw new Error("AI rate-limited");
    throw new Error(`AI error ${resp.status}`);
  }

  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
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

