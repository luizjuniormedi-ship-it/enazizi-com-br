// Memory Consolidation Engine — Sprint 1
// Aciona-se ao final de uma sessão do Tutor V3 / revisão de erro / FSRS due.
// Fluxo: start → step (retrieval/connective_summary/metacog/confidence) → complete.
// Reusa LOVABLE_API_KEY (gateway) para avaliação curta das respostas.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

type Step = "retrieval" | "connective_summary" | "metacog" | "confidence";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  return data.user?.id ?? null;
}

/** Avaliação curta via Lovable AI Gateway. Retorna {score 0-100, feedback}. */
async function aiEvaluate(step: Step, topic: string, response: string): Promise<{ score: number; feedback: string }> {
  if (!LOVABLE_API_KEY || !response?.trim()) {
    return { score: response?.trim() ? 60 : 0, feedback: "" };
  }

  const rubric: Record<Step, string> = {
    retrieval: "Avalie precisão factual e completude da resposta de recall ativo. Penalize alucinações.",
    connective_summary: "Avalie profundidade (depth>=2): conecta com tema anterior, mecanismo fisiopatológico, clínica.",
    metacog: "Avalie qualidade da auto-reflexão: específica > genérica. Reconhecer lacuna concreta = bom.",
    confidence: "Apenas registre — não avalie.",
  };

  const system =
    "Você é um avaliador pedagógico médico (ENAZIZI). Responda EXCLUSIVAMENTE com JSON " +
    `{"score": <0-100 inteiro>, "feedback": "<até 240 chars, pt-BR>"}.`;

  const user = `Tema: ${topic}\nEtapa: ${step}\nRubrica: ${rubric[step]}\nResposta do aluno:\n"""${response.slice(0, 2000)}"""`;

  try {
    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!r.ok) {
      await r.text();
      return { score: 60, feedback: "" };
    }
    const j = await r.json();
    const txt: string = j?.choices?.[0]?.message?.content ?? "{}";
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : {};
    const score = Math.max(0, Math.min(100, Number(parsed.score ?? 60)));
    return { score, feedback: String(parsed.feedback ?? "").slice(0, 240) };
  } catch (_e) {
    return { score: 60, feedback: "" };
  }
}

async function emitBusEvent(
  sb: ReturnType<typeof admin>,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const key = `mce_${userId}_${eventType}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  await sb.from("pedagogical_events").upsert(
    {
      user_id: userId,
      event_type: eventType,
      module: "tutor",
      source: "edge_function",
      severity: "info",
      study_context: payload.study_context ?? {},
      cognitive_context: payload.cognitive_context ?? {},
      metadata: { ...payload, engine: "memory_consolidation_v1" },
      idempotency_key: key,
      status: "pending",
    },
    { onConflict: "idempotency_key", ignoreDuplicates: false },
  );
}

function pct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function windowDays(label: "7d" | "30d" | "90d") {
  return label === "7d" ? 7 : label === "30d" ? 30 : 90;
}

async function recomputeMetrics(sb: ReturnType<typeof admin>, userId: string, topicId: string | null, topicLabel: string | null) {
  for (const w of ["7d", "30d", "90d"] as const) {
    const since = new Date(Date.now() - windowDays(w) * 86400_000).toISOString();
    const q = sb
      .from("memory_consolidation_sessions")
      .select("mastery_score, confidence_score, false_confidence_flag, metacog_quality")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", since);
    const { data } = topicId ? await q.eq("topic_id", topicId) : await q.eq("topic_label", topicLabel ?? "");
    const rows = data ?? [];
    const n = rows.length;
    if (n === 0) continue;
    const mastery_avg = rows.reduce((a, r) => a + (Number(r.mastery_score) || 0), 0) / n;
    const fc_rate = rows.filter((r) => r.false_confidence_flag).length / n;
    const metacog_avg = rows.reduce((a, r) => a + (Number(r.metacog_quality) || 0), 0) / n;
    // retention proxy = mastery ponderado pela confiança calibrada
    const retention_index = mastery_avg * (1 - fc_rate * 0.5);
    const knowledge_gap_score = Math.max(0, 100 - mastery_avg) * (1 - metacog_avg / 100);

    await sb.from("memory_consolidation_metrics").upsert(
      {
        user_id: userId,
        topic_id: topicId,
        topic_label: topicLabel,
        window_label: w,
        mastery_avg: Math.round(mastery_avg * 10) / 10,
        retention_index: Math.round(retention_index * 10) / 10,
        false_confidence_rate: Math.round(fc_rate * 1000) / 1000,
        knowledge_gap_score: Math.round(knowledge_gap_score * 10) / 10,
        sample_size: n,
        is_experimental: n < 30,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_id,window_label" },
    );
  }
}

const PROMPTS: Record<Step, (topic: string, ctx?: string) => string> = {
  retrieval: (t) => `Sobre **${t}**: liste, sem consultar nada, os 3 pontos mais importantes (mecanismo, clínica, conduta).`,
  connective_summary: (t, ctx) =>
    `Escreva um resumo conectivo (3-5 frases) sobre **${t}** ${ctx ? `relacionando com: ${ctx}` : ""}. Foque em mecanismo → clínica → conduta.`,
  metacog: (t) => `Sobre **${t}**: o que você ainda NÃO entendeu bem? Seja específico (subtema, dúvida concreta).`,
  confidence: (t) => `Antes de revelar o gabarito final: qual sua confiança (0–100) sobre **${t}**?`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) return corsResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const sb = admin();

    // ----- START -----
    if (action === "start") {
      const topic_label = String(body.topic_label ?? "").slice(0, 240);
      if (!topic_label) return corsResponse({ error: "topic_label required" }, 400);
      const { data, error } = await sb
        .from("memory_consolidation_sessions")
        .insert({
          user_id: userId,
          topic_id: body.topic_id ?? null,
          topic_label,
          subtopic_id: body.subtopic_id ?? null,
          source: body.source ?? "tutor_v3",
          trigger_event_id: body.trigger_event_id ?? null,
          metadata: { context_summary: body.context_summary ?? null },
        })
        .select()
        .single();
      if (error) return corsResponse({ error: error.message }, 500);

      await emitBusEvent(sb, userId, "memory_consolidation_started", {
        session_id: data.id,
        study_context: { topic: topic_label },
      });

      const prompts: Record<Step, string> = {
        retrieval: PROMPTS.retrieval(topic_label),
        connective_summary: PROMPTS.connective_summary(topic_label, body.context_summary),
        metacog: PROMPTS.metacog(topic_label),
        confidence: PROMPTS.confidence(topic_label),
      };
      return corsResponse({ session: data, prompts });
    }

    // ----- STEP -----
    if (action === "step") {
      const session_id = String(body.session_id ?? "");
      const step = String(body.step ?? "") as Step;
      if (!session_id || !["retrieval", "connective_summary", "metacog", "confidence"].includes(step)) {
        return corsResponse({ error: "invalid step" }, 400);
      }
      const { data: sess } = await sb
        .from("memory_consolidation_sessions")
        .select("id, user_id, topic_label, metadata")
        .eq("id", session_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!sess) return corsResponse({ error: "session not found" }, 404);

      const startT = Date.now();
      let score: number | null = null;
      let feedback = "";

      if (step === "confidence") {
        score = pct(Number(body.confidence_value ?? 0));
      } else {
        const ev = await aiEvaluate(step, sess.topic_label ?? "", String(body.response ?? ""));
        score = ev.score;
        feedback = ev.feedback;
      }

      const prompt = PROMPTS[step](sess.topic_label ?? "", (sess.metadata as any)?.context_summary);

      const { data: resp, error } = await sb
        .from("memory_consolidation_responses")
        .insert({
          session_id,
          user_id: userId,
          step,
          prompt,
          response: String(body.response ?? body.confidence_value ?? ""),
          ai_evaluation: { feedback },
          score,
          latency_ms: Date.now() - startT,
        })
        .select()
        .single();
      if (error) return corsResponse({ error: error.message }, 500);

      return corsResponse({ response: resp, feedback, score });
    }

    // ----- COMPLETE -----
    if (action === "complete") {
      const session_id = String(body.session_id ?? "");
      const { data: sess } = await sb
        .from("memory_consolidation_sessions")
        .select("id, user_id, topic_id, topic_label")
        .eq("id", session_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!sess) return corsResponse({ error: "session not found" }, 404);

      const { data: rows } = await sb
        .from("memory_consolidation_responses")
        .select("step, score")
        .eq("session_id", session_id);

      const byStep: Record<string, number> = {};
      for (const r of rows ?? []) byStep[r.step] = Number(r.score ?? 0);

      // mastery = média ponderada das etapas substantivas
      const mastery = pct(
        (byStep["retrieval"] ?? 60) * 0.5 +
          (byStep["connective_summary"] ?? 60) * 0.35 +
          (byStep["metacog"] ?? 60) * 0.15,
      );
      const confidence = pct(byStep["confidence"] ?? 50);
      const metacog_quality = pct(byStep["metacog"] ?? 50);
      const false_confidence_flag = confidence >= 80 && mastery < 60;

      const summary = `mastery ${mastery} · confidence ${confidence}${false_confidence_flag ? " · ⚠ falsa confiança" : ""}`;

      await sb
        .from("memory_consolidation_sessions")
        .update({
          status: "completed",
          mastery_score: mastery,
          confidence_score: confidence,
          metacog_quality,
          false_confidence_flag,
          summary_text: summary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id);

      const emitted: string[] = [];

      await emitBusEvent(sb, userId, "memory_consolidation_completed", {
        session_id,
        mastery,
        confidence,
        metacog_quality,
        study_context: { topic: sess.topic_label },
      });
      emitted.push("memory_consolidation_completed");

      if (false_confidence_flag) {
        await emitBusEvent(sb, userId, "false_confidence_detected", {
          mastery,
          confidence,
          study_context: { topic: sess.topic_label },
          cognitive_context: { error_pressure: (100 - mastery) / 100 },
        });
        emitted.push("false_confidence_detected");
      }

      if (mastery < 55) {
        await emitBusEvent(sb, userId, "knowledge_gap_detected", {
          gap_score: 100 - mastery,
          study_context: { topic: sess.topic_label },
        });
        emitted.push("knowledge_gap_detected");
      }

      if (mastery < 65 || false_confidence_flag) {
        await emitBusEvent(sb, userId, "review_priority_increased", {
          delta: false_confidence_flag ? 25 : 15,
          reason: false_confidence_flag ? "false_confidence" : "low_mastery",
          study_context: { topic: sess.topic_label },
        });
        emitted.push("review_priority_increased");
      }

      // métricas agregadas (LGPD-safe, scope=user)
      await recomputeMetrics(sb, userId, sess.topic_id, sess.topic_label);

      return corsResponse({
        session_id,
        mastery_score: mastery,
        confidence_score: confidence,
        false_confidence_flag,
        metacog_quality,
        summary,
        emitted_events: emitted,
      });
    }

    return corsResponse({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[memory-consolidation] error", e);
    return corsResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
