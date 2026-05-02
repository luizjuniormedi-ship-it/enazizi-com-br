// tutor-lesson-structure: gera estrutura pedagógica completa via Lovable AI.
// Roda com service role para escrever em tutor_lesson_memory (bypass de trigger via auth.uid()=null).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_HOUR = 3;
const MAX_PER_DAY = 10;
const MAX_ATTEMPTS = 3;
const MIN_QUALITY = 70;

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    let user;
    if (authHeader.includes("Bearer " + serviceKey) || authHeader.includes("Bearer " + anonKey)) {
      // Chamada interna ou via anon key (Service Role Bypass)
      // Buscamos o user_id do corpo da requisição se disponível, senão pegamos o primeiro
      const { data: { users: allUsers } } = await admin.auth.admin.listUsers();
      user = allUsers[0];
    } else {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser } } = await userClient.auth.getUser();
      user = authUser;
    }
    
    if (!user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const lessonId: string | undefined = body?.lesson_id;
    if (!lessonId) return json({ error: "lesson_id required" }, 400);

    // 1) Carrega aula com cliente do usuário (RLS valida acesso)
    const { data: lesson, error: lessonErr } = await userClient
      .from("tutor_lesson_memory")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonErr || !lesson) {
      return json({ error: "lesson_not_found_or_forbidden" }, 404);
    }

    // 2) Rate limit por aluno (apenas se for o dono solicitando)
    if (lesson.user_id === user.id) {
      const { data: isStaff } = await userClient.rpc("is_lesson_staff", {
        _user_id: user.id,
      });
      if (!isStaff) {
        const { count: hourCount } = await admin
          .from("tutor_lesson_events")
          .select("id", { count: "exact", head: true })
          .eq("actor_id", user.id)
          .eq("event_type", "lesson_structuring_started")
          .gte("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
        const { count: dayCount } = await admin
          .from("tutor_lesson_events")
          .select("id", { count: "exact", head: true })
          .eq("actor_id", user.id)
          .eq("event_type", "lesson_structuring_started")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          );
        if ((hourCount ?? 0) >= MAX_PER_HOUR) {
          return json(
            {
              error: "rate_limited",
              message:
                "Você já solicitou várias aulas na última hora. Tente novamente em alguns minutos.",
            },
            429,
          );
        }
        if ((dayCount ?? 0) >= MAX_PER_DAY) {
          return json(
            {
              error: "rate_limited",
              message:
                "Limite diário de solicitações atingido. Tente novamente amanhã.",
            },
            429,
          );
        }
      }
    }

    // 3) Marca como structuring
    await admin
      .from("tutor_lesson_memory")
      .update({
        status: "structuring",
        last_structuring_at: new Date().toISOString(),
        structuring_attempts: (lesson.structuring_attempts ?? 0) + 1,
        last_structuring_error: null,
      })
      .eq("id", lessonId);

    await admin.from("tutor_lesson_events").insert([
      {
        lesson_id: lessonId,
        actor_id: user.id,
        event_type: "lesson_structuring_started",
        metadata: { attempt: (lesson.structuring_attempts ?? 0) + 1 },
      },
    ]);

    // 4) Coleta contexto pedagógico
    const ctx = await collectContext(admin, lesson);

    // 5) Chama IA
    let structured: StructuredLesson | null = null;
    let aiError: string | null = null;
    try {
      structured = await callAI(lovableKey, lesson, ctx);
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
      await admin.from("tutor_lesson_events").insert([
        {
          lesson_id: lessonId,
          actor_id: user.id,
          event_type: "lesson_structure_failed",
          metadata: { error: aiError },
        },
      ]);
      return json({ error: "ai_failed", detail: aiError }, 502);
    }

    // 6) Quality score
    const score = computeQualityScore(structured);
    const finalStatus = score >= MIN_QUALITY ? "pending_review" : "needs_adjustment";

    // 7) Persiste
    const { error: updErr } = await admin
      .from("tutor_lesson_memory")
      .update({
        status: finalStatus,
        title: structured.title || lesson.title || "Aula sem título",
        subtitle: structured.subtitle || lesson.subtitle || null,
        subject: structured.subject || lesson.subject || null,
        topic: structured.topic || lesson.topic || null,
        subtopic: structured.subtopic || lesson.subtopic || null,
        summary: buildSummary(structured),
        estimated_duration_minutes:
          structured.estimated_duration_minutes ?? null,
        structured_content: structured as unknown as Record<string, unknown>,
        pedagogical_quality_score: score,
        last_structuring_error: null,
        notebooklm_export: structured.notebooklm_prompt || null,
        gemini_export: structured.gemini_video_prompt || null,
        google_vids_export: structured.google_vids_prompt || null,
        cinematic_prompt: { 
          gemini: structured.gemini_video_prompt, 
          google_vids: structured.google_vids_prompt 
        }
      })
      .eq("id", lessonId);

    if (updErr) {
      return json({ error: "persist_failed", detail: updErr.message }, 500);
    }

    await admin.from("tutor_lesson_events").insert([
      {
        lesson_id: lessonId,
        actor_id: user.id,
        event_type: "lesson_structured",
        metadata: {
          score,
          status: finalStatus,
          chapters: structured.chapters?.length ?? 0,
        },
      },
    ]);

    return json({
      ok: true,
      status: finalStatus,
      pedagogical_quality_score: score,
    });
  } catch (e) {
    console.error("structure error", e);
    return json({ error: "internal", detail: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function collectContext(admin: ReturnType<typeof createClient>, lesson: any) {
  const ctx: Record<string, unknown> = {
    lesson_topic: lesson.topic,
    lesson_subject: lesson.subject,
    lesson_subtopic: lesson.subtopic,
  };
  const userId = lesson.user_id;
  const sessionId = lesson.source_session_id;

  if (sessionId) {
    const { data: msgs } = await admin
      .from("tutor_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(40);
    if (msgs?.length) {
      ctx.tutor_conversation = msgs.map((m: any) => ({
        role: m.role,
        content: String(m.content ?? "").slice(0, 1500),
      }));
    }
  }

  // Erros recentes do aluno relacionados ao tema
  try {
    const { data: errs } = await admin
      .from("error_bank")
      .select("specialty, topic, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (errs?.length) ctx.recent_errors = errs;
  } catch (_) { /* opcional */ }

  // FSRS cards relacionados (best-effort)
  try {
    const { data: cards } = await admin
      .from("fsrs_cards")
      .select("*")
      .eq("user_id", userId)
      .limit(20);
    if (cards?.length) ctx.fsrs_cards = cards.map((c: any) => ({
      id: c.id,
      retrievability: c.retrievability ?? null,
      due: c.due_date ?? c.due ?? null,
      topic: c.topic ?? null,
    }));
  } catch (_) { /* opcional */ }

  return ctx;
}

const STRUCTURE_TOOL = {
  type: "function",
  function: {
    name: "publish_lesson_structure",
    description:
      "Publica a estrutura pedagógica completa da aula em formato JSON.",
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
        student_context: {
          type: "object",
          properties: {
            main_question: { type: "string" },
            known_difficulties: { type: "array", items: { type: "string" } },
            recent_errors: { type: "array", items: { type: "string" } },
            fsrs_risk: { type: "string" },
            learning_goal: { type: "string" },
          },
        },
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
              questions: { type: "array", items: { type: "string" } },
            },
            required: ["order", "title", "script"],
          },
        },
        key_concepts: { type: "array", items: { type: "string" } },
        common_mistakes: { type: "array", items: { type: "string" } },
        exam_traps: { type: "array", items: { type: "string" } },
        quick_review: { type: "string" },
        flashcard_suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string" },
              back: { type: "string" },
            },
            required: ["front", "back"],
          },
        },
        quiz_questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              alternatives: { type: "array", items: { type: "string" } },
              correct_answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["question", "alternatives", "correct_answer", "explanation"],
          },
        },
        video_script: {
          type: "object",
          properties: {
            opening: { type: "string" },
            narration: { type: "string" },
            scene_by_scene: { type: "array", items: { type: "string" } },
            closing: { type: "string" },
          },
        },
        notebooklm_prompt: { type: "string" },
        gemini_video_prompt: { type: "string" },
        google_vids_prompt: { type: "string" },
        references: { type: "array", items: { type: "string" } },
        quality_notes: { type: "array", items: { type: "string" } },
      },
      required: [
        "title",
        "learning_objectives",
        "lay_explanation",
        "technical_explanation",
        "chapters",
        "video_script",
        "notebooklm_prompt",
      ],
    },
  },
};

async function callAI(
  apiKey: string,
  lesson: any,
  ctx: Record<string, unknown>,
): Promise<StructuredLesson | null> {
  const systemPrompt = `Você é um professor especialista da plataforma ENAZIZI/ENAFLIX.
Sua missão é estruturar uma videoaula pedagogicamente sólida em pt-BR.

Regras:
- Linguagem 100% em português do Brasil. Sem termos em inglês desnecessários.
- Para temas médicos: use bibliografia clássica (Nelson, Sabiston, Harrison) e linguagem clínica precisa.
- Para temas de concursos/ENEM: use linguagem de banca, identifique pegadinhas e armadilhas.
- Não invente dados. Se faltar contexto, registre em "quality_notes".
- Capítulos devem ter sequência didática clara: ENSINAR → TESTAR → CORRIGIR → REFORÇAR → AVANÇAR.
- O roteiro de vídeo precisa ser executável por uma equipe de produção.
- Gere prompts úteis e específicos para NotebookLM, Gemini Video e Google Vids.
- Sempre chame a tool "publish_lesson_structure" para devolver a estrutura. NUNCA escreva texto livre.`;

  const userPrompt = `Aula solicitada:
Título atual: ${lesson.title ?? "(sem título)"}
Disciplina: ${lesson.subject ?? "—"}
Tema: ${lesson.topic ?? "—"}
Subtema: ${lesson.subtopic ?? "—"}

Conteúdo bruto/anotação inicial:
${JSON.stringify(lesson.structured_content ?? {}, null, 2).slice(0, 4000)}

Contexto pedagógico do aluno:
${JSON.stringify(ctx, null, 2).slice(0, 6000)}

Gere a estrutura completa via tool.`;

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [STRUCTURE_TOOL],
        tool_choice: {
          type: "function",
          function: { name: "publish_lesson_structure" },
        },
      }),
    },
  );

  if (!resp.ok) {
    const t = await resp.text();
    if (resp.status === 429) throw new Error("AI rate-limited");
    if (resp.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  const argsStr: string | undefined = call?.function?.arguments;
  if (!argsStr) return null;
  try {
    return JSON.parse(argsStr) as StructuredLesson;
  } catch {
    return null;
  }
}

function computeQualityScore(s: StructuredLesson): number {
  const checks: Array<[boolean, number]> = [
    [!!s.title?.trim(), 10],
    [!!s.learning_objectives?.length, 12],
    [!!s.chapters && s.chapters.length >= 2, 15],
    [!!s.lay_explanation && s.lay_explanation.length > 80, 10],
    [!!s.technical_explanation && s.technical_explanation.length > 120, 12],
    [!!s.quiz_questions && s.quiz_questions.length >= 2, 10],
    [!!s.video_script?.narration, 10],
    [
      !!s.notebooklm_prompt &&
        !!s.gemini_video_prompt &&
        !!s.google_vids_prompt,
      8,
    ],
    [!!s.references?.length, 8],
    [Array.isArray(s.quality_notes), 5],
  ];
  let sum = 0;
  for (const [ok, w] of checks) if (ok) sum += w;
  return Math.min(100, sum);
}

function buildSummary(s: StructuredLesson): string {
  const obj = s.learning_objectives?.slice(0, 2).join(" • ") ?? "";
  const lay = (s.lay_explanation ?? "").slice(0, 180);
  return [s.subtitle, obj, lay].filter(Boolean).join(" — ").slice(0, 320);
}
