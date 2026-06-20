// ============================================================
// ENAZIZI Memory Consolidation Engine — V4.0
// 14 etapas pedagógicas. Não ensina conteúdo novo: consolida,
// detecta lacunas, mede domínio real e gera evidências
// reaproveitáveis por Tutor V3, Error Bank, FSRS, Planner,
// Simulados, Cognitive State e Analytics.
//
// Adaptação por High Yield Score:
//   >= 70  → rigor 'full'        (todas as etapas, ENAMED takeaways obrigatórios)
//   40-69  → rigor 'standard'    (retrieval + metacog + confidence + synthesis)
//   <  40  → rigor 'simplified'  (retrieval + confidence + synthesis curta)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders, corsResponse } from "../_shared/cors.ts";

type Step =
  | "retrieval"
  | "generation_effect"
  | "clinical_recall"
  | "connective_summary"
  | "metacog"
  | "confidence";

type RigorLevel = "simplified" | "standard" | "full";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL_FAST = "google/gemini-3-flash-preview";

// Temas críticos para Medicina (override de rigor mesmo com HYS baixo)
const CRITICAL_SPECIALTIES_KEYWORDS = [
  "IAM", "infarto", "sepse", "TEP", "tromboembolismo",
  "AVC", "acidente vascular", "pré-eclâmpsia", "preeclampsia",
  "eclampsia", "choque", "anafilaxia", "PCR", "parada card",
  "meningite", "cetoacidose", "hipoglicemia",
];

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  return data.user?.id ?? null;
}

function pct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function classifyRigor(highYield: number, topicLabel: string): RigorLevel {
  const hay = `${topicLabel}`.toLowerCase();
  const isCritical = CRITICAL_SPECIALTIES_KEYWORDS.some((k) => hay.includes(k.toLowerCase()));
  if (isCritical || highYield >= 70) return "full";
  if (highYield >= 40) return "standard";
  return "simplified";
}

function classifyCognitiveState(mastery: number, metacog: number): string {
  if (mastery >= 90 && metacog >= 70) return "AUTOMATIZACAO";
  if (mastery >= 80) return "DOMINIO";
  if (mastery >= 65) return "APLICACAO";
  if (mastery >= 45) return "COMPREENSAO";
  if (mastery >= 25) return "RECONHECIMENTO";
  return "NOVATO";
}

function gapSeverity(mastery: number): "mild" | "moderate" | "severe" | "critical" {
  if (mastery < 25) return "critical";
  if (mastery < 45) return "severe";
  if (mastery < 65) return "moderate";
  return "mild";
}

// ------------------------------------------------------------
// AI call helpers
// ------------------------------------------------------------

async function gatewayChat(
  system: string,
  user: string,
  opts: { json?: boolean; temperature?: number } = {},
): Promise<string> {
  if (!LOVABLE_API_KEY) return "{}";
  const body: Record<string, unknown> = {
    model: MODEL_FAST,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  try {
    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      await r.text();
      return "{}";
    }
    const j = await r.json();
    return String(j?.choices?.[0]?.message?.content ?? "{}");
  } catch (_e) {
    return "{}";
  }
}

function parseJson(s: string): Record<string, unknown> {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch { return {}; }
}

/** Avaliação curta de uma etapa: retorna {score 0-100, feedback}. */
async function aiEvaluateStep(
  step: Step,
  topic: string,
  response: string,
): Promise<{ score: number; feedback: string }> {
  if (!response?.trim()) return { score: 0, feedback: "" };

  const rubric: Record<Step, string> = {
    retrieval:
      "Recall livre. Avalie precisão factual, completude, presença de terminologia médica e estrutura (mecanismo → clínica → conduta). Penalize alucinação.",
    generation_effect:
      "Aluno explica como se ensinasse um interno. Avalie clareza didática, profundidade conceitual (depth>=2), conexão com caso clínico e raciocínio.",
    clinical_recall:
      "Resposta a pergunta clínica adaptativa. Avalie acerto diagnóstico/condutual e raciocínio fisiopatológico.",
    connective_summary:
      "Resumo conectivo. Avalie conexão entre mecanismo, clínica e conduta + diferencial.",
    metacog:
      "Auto-reflexão. Avalie especificidade — reconhecer lacuna concreta vale mais que 'entendi tudo'.",
    confidence: "Apenas registro, não avalie.",
  };

  const system =
    "Você é o avaliador pedagógico do ENAZIZI (MCE V4). Responda EXCLUSIVAMENTE com JSON " +
    `{"score": <0-100 inteiro>, "feedback": "<até 240 chars, pt-BR, sem 'however' nem inglês>"}.`;
  const user = `Tema: ${topic}\nEtapa: ${step}\nRubrica: ${rubric[step]}\nResposta:\n"""${response.slice(0, 2500)}"""`;

  const raw = await gatewayChat(system, user, { json: true, temperature: 0.2 });
  const parsed = parseJson(raw);
  const score = pct(Number(parsed.score ?? 60));
  const feedback = String(parsed.feedback ?? "").slice(0, 240);
  return { score, feedback };
}

// ------------------------------------------------------------
// Prompts apresentados ao aluno (por etapa)
// ------------------------------------------------------------

function buildPrompts(topic: string, contextSummary?: string): Record<Step, string> {
  return {
    retrieval:
      `Sem consultar material, explique com suas palavras o que acabou de aprender sobre **${topic}**. ` +
      `Cite mecanismo, apresentação clínica e conduta inicial.`,
    generation_effect:
      `Agora explique **${topic}** como se estivesse ensinando um interno do primeiro ano. ` +
      `Use um caso clínico breve e cite ao menos um diagnóstico diferencial.`,
    clinical_recall:
      `Cenário rápido sobre **${topic}**: qual o diagnóstico mais provável, qual exame confirma e qual a próxima conduta?`,
    connective_summary:
      `Resumo conectivo (3-5 frases) sobre **${topic}**${contextSummary ? ` relacionando com: ${contextSummary}` : ""}. ` +
      `Conecte mecanismo → clínica → conduta → pegadinha de prova.`,
    metacog:
      `Sobre **${topic}**: o que você ainda NÃO entendeu bem? Seja específico (subtema, dúvida concreta).`,
    confidence:
      `Antes do gabarito final, sua confiança em **${topic}**? (1 = não entendi · 5 = consigo ensinar)`,
  };
}

function stepsForRigor(rigor: RigorLevel): Step[] {
  if (rigor === "full") {
    return ["retrieval", "generation_effect", "clinical_recall", "metacog", "confidence"];
  }
  if (rigor === "standard") {
    return ["retrieval", "generation_effect", "metacog", "confidence"];
  }
  return ["retrieval", "metacog", "confidence"];
}

// ------------------------------------------------------------
// Síntese V4: gera saída estruturada das etapas 6-13
// ------------------------------------------------------------

interface SynthesisOutput {
  knowledge_gaps: Array<{ topic: string; subtopic?: string; severity: string }>;
  fsrs_cards_to_create: Array<{ type: string; front: string; back: string; priority?: number }>;
  planner_updates: Array<{ topic: string; delta: number; reason: string }>;
  enamed_takeaways: {
    must_memorize: string[];
    exam_pattern: string[];
    trap: string;
    cannot_forget_conduct: string;
  };
  summary: string;
}

async function synthesizeV4(args: {
  topic: string;
  specialty?: string | null;
  rigor: RigorLevel;
  mastery: number;
  confidence: number;
  metacog: number;
  highYield: number;
  enamedRelevance: number;
  recentMistakes: string[];
  responses: Array<{ step: Step; response: string; score: number }>;
}): Promise<SynthesisOutput> {
  const fallback: SynthesisOutput = {
    knowledge_gaps: args.mastery < 65
      ? [{ topic: args.topic, severity: gapSeverity(args.mastery) }]
      : [],
    fsrs_cards_to_create: [],
    planner_updates: args.mastery < 65
      ? [{ topic: args.topic, delta: args.mastery < 45 ? 25 : 15, reason: "low_mastery" }]
      : [],
    enamed_takeaways: { must_memorize: [], exam_pattern: [], trap: "", cannot_forget_conduct: "" },
    summary: `Domínio ${args.mastery} · confiança ${args.confidence}`,
  };

  if (!LOVABLE_API_KEY) return fallback;

  const expectedCards = args.rigor === "full" ? 5 : args.rigor === "standard" ? 3 : 1;
  const responsesBlock = args.responses
    .map((r) => `- [${r.step} | score ${r.score}]: ${r.response.slice(0, 600)}`)
    .join("\n");

  const system =
    "Você é o Memory Consolidation Engine V4 do ENAZIZI. " +
    "Tema MÉDICO. Produza saída estruturada para alimentar Error Bank, FSRS, Planner e ENAMED takeaways. " +
    "Responda EXCLUSIVAMENTE com JSON válido, pt-BR, sem inglês, sem 'however', sem markdown fora dos campos. " +
    `Gere exatamente ${expectedCards} flashcard(s) (mix de concept/diagnosis/conduct/trap/differential). ` +
    "ENAMED takeaways: must_memorize<=3, exam_pattern<=2, trap=1 frase, cannot_forget_conduct=1 frase. " +
    "knowledge_gaps com severity em mild|moderate|severe|critical. " +
    "planner_updates delta em 5-30 (urgência), reason curto.";

  const user = JSON.stringify({
    tema: args.topic,
    especialidade: args.specialty ?? null,
    rigor: args.rigor,
    mastery_score: args.mastery,
    confidence_score: args.confidence,
    metacog_quality: args.metacog,
    high_yield_score: args.highYield,
    enamed_relevance: args.enamedRelevance,
    erros_recentes: args.recentMistakes.slice(0, 5),
    respostas_do_aluno: responsesBlock,
    schema_obrigatorio: {
      knowledge_gaps: [{ topic: "", subtopic: "", severity: "mild|moderate|severe|critical" }],
      fsrs_cards_to_create: [{ type: "concept|diagnosis|conduct|trap|differential", front: "", back: "", priority: 0 }],
      planner_updates: [{ topic: "", delta: 0, reason: "" }],
      enamed_takeaways: { must_memorize: [], exam_pattern: [], trap: "", cannot_forget_conduct: "" },
      summary: "string curta",
    },
  });

  const raw = await gatewayChat(system, user, { json: true, temperature: 0.3 });
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object") return fallback;

  return {
    knowledge_gaps: Array.isArray(parsed.knowledge_gaps) ? (parsed.knowledge_gaps as any[]).slice(0, 6) : fallback.knowledge_gaps,
    fsrs_cards_to_create: Array.isArray(parsed.fsrs_cards_to_create) ? (parsed.fsrs_cards_to_create as any[]).slice(0, expectedCards) : [],
    planner_updates: Array.isArray(parsed.planner_updates) ? (parsed.planner_updates as any[]).slice(0, 5) : fallback.planner_updates,
    enamed_takeaways: (parsed.enamed_takeaways as any) ?? fallback.enamed_takeaways,
    summary: String(parsed.summary ?? fallback.summary).slice(0, 400),
  };
}

// ------------------------------------------------------------
// Event Bus
// ------------------------------------------------------------

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
      study_context: (payload.study_context as Record<string, unknown>) ?? {},
      cognitive_context: (payload.cognitive_context as Record<string, unknown>) ?? {},
      metadata: { ...payload, engine: "memory_consolidation_v4" },
      idempotency_key: key,
      status: "pending",
    },
    { onConflict: "idempotency_key", ignoreDuplicates: false },
  );
}

// ------------------------------------------------------------
// Métricas agregadas (LGPD scope=user)
// ------------------------------------------------------------

function windowDays(w: "7d" | "30d" | "90d") {
  return w === "7d" ? 7 : w === "30d" ? 30 : 90;
}

async function recomputeMetrics(
  sb: ReturnType<typeof admin>,
  userId: string,
  topicId: string | null,
  topicLabel: string | null,
) {
  for (const w of ["7d", "30d", "90d"] as const) {
    const since = new Date(Date.now() - windowDays(w) * 86400_000).toISOString();
    let q = sb
      .from("memory_consolidation_sessions")
      .select("mastery_score, confidence_score, false_confidence_flag, metacog_quality")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", since);
    q = topicId ? q.eq("topic_id", topicId) : q.eq("topic_label", topicLabel ?? "");
    const { data } = await q;
    const rows = data ?? [];
    const n = rows.length;
    if (n === 0) continue;
    const mastery_avg = rows.reduce((a, r) => a + (Number(r.mastery_score) || 0), 0) / n;
    const fc_rate = rows.filter((r) => r.false_confidence_flag).length / n;
    const metacog_avg = rows.reduce((a, r) => a + (Number(r.metacog_quality) || 0), 0) / n;
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
        is_experimental: n < 30, // guard-rail Sprint 2.3
        computed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_id,window_label" },
    );
  }
}

// ------------------------------------------------------------
// HTTP handler
// ------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) return corsResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const sb = admin();

    // -------- START --------
    if (action === "start") {
      const topic_label = String(body.topic_label ?? "").slice(0, 240);
      if (!topic_label) return corsResponse({ error: "topic_label required" }, 400);

      const high_yield_score = pct(Number(body.high_yield_score ?? 50));
      const rigor = classifyRigor(high_yield_score, topic_label);
      const steps = stepsForRigor(rigor);

      const { data: sess, error } = await sb
        .from("memory_consolidation_sessions")
        .insert({
          user_id: userId,
          topic_id: body.topic_id ?? null,
          topic_label,
          subtopic_id: body.subtopic_id ?? null,
          source: body.source ?? "tutor_v3",
          trigger_event_id: body.trigger_event_id ?? null,
          specialty: body.specialty ?? null,
          high_yield_score,
          enamed_relevance: pct(Number(body.enamed_relevance ?? high_yield_score)),
          cognitive_state: body.cognitive_state ?? null,
          rigor_level: rigor,
          metadata: {
            context_summary: body.context_summary ?? null,
            student_level: body.student_level ?? null,
            recent_mistakes: Array.isArray(body.recent_mistakes) ? body.recent_mistakes.slice(0, 10) : [],
            error_bank_context: Array.isArray(body.error_bank_context) ? body.error_bank_context.slice(0, 10) : [],
            fsrs_context: Array.isArray(body.fsrs_context) ? body.fsrs_context.slice(0, 10) : [],
            steps,
          },
        })
        .select()
        .single();
      if (error) return corsResponse({ error: error.message }, 500);

      await emitBusEvent(sb, userId, "memory_consolidation_started", {
        session_id: sess.id,
        rigor,
        high_yield_score,
        study_context: { topic: topic_label, specialty: body.specialty ?? null },
      });

      const allPrompts = buildPrompts(topic_label, body.context_summary);
      const prompts: Partial<Record<Step, string>> = {};
      for (const s of steps) prompts[s] = allPrompts[s];

      return corsResponse({ session: sess, prompts, steps, rigor });
    }

    // -------- STEP --------
    if (action === "step") {
      const session_id = String(body.session_id ?? "");
      const step = String(body.step ?? "") as Step;
      const allowed: Step[] = [
        "retrieval", "generation_effect", "clinical_recall",
        "connective_summary", "metacog", "confidence",
      ];
      if (!session_id || !allowed.includes(step)) {
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
      let score = 0;
      let feedback = "";

      if (step === "confidence") {
        // Aceita Likert 1-5 ou 0-100
        const raw = Number(body.confidence_value ?? 0);
        score = raw <= 5 ? pct(((raw - 1) / 4) * 100) : pct(raw);
      } else {
        const ev = await aiEvaluateStep(step, sess.topic_label ?? "", String(body.response ?? ""));
        score = ev.score;
        feedback = ev.feedback;
      }

      const promptText = buildPrompts(
        sess.topic_label ?? "",
        (sess.metadata as any)?.context_summary,
      )[step];

      const { data: resp, error } = await sb
        .from("memory_consolidation_responses")
        .insert({
          session_id,
          user_id: userId,
          step,
          prompt: promptText,
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

    // -------- COMPLETE --------
    if (action === "complete") {
      const session_id = String(body.session_id ?? "");
      const { data: sess } = await sb
        .from("memory_consolidation_sessions")
        .select("id, user_id, topic_id, topic_label, specialty, high_yield_score, enamed_relevance, rigor_level, source, metadata")
        .eq("id", session_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!sess) return corsResponse({ error: "session not found" }, 404);

      const { data: rows } = await sb
        .from("memory_consolidation_responses")
        .select("step, score, response")
        .eq("session_id", session_id);

      const byStep: Record<string, { score: number; response: string }> = {};
      for (const r of rows ?? []) {
        byStep[r.step] = { score: Number(r.score ?? 0), response: String(r.response ?? "") };
      }

      // Etapa 6 — mastery (média ponderada das etapas substantivas presentes)
      const weights: Partial<Record<Step, number>> = {
        retrieval: 0.40,
        generation_effect: 0.30,
        clinical_recall: 0.20,
        connective_summary: 0.20,
        metacog: 0.10,
      };
      let num = 0;
      let den = 0;
      for (const [k, w] of Object.entries(weights) as Array<[Step, number]>) {
        if (byStep[k]) {
          num += byStep[k].score * w;
          den += w;
        }
      }
      const mastery = pct(den > 0 ? num / den : 60);
      const confidence = pct(byStep["confidence"]?.score ?? 50);
      const metacog_quality = pct(byStep["metacog"]?.score ?? 50);

      // Etapa 7 — falsa confiança
      const false_confidence = confidence >= 80 && mastery < 60;

      // Etapa 12 — estado cognitivo
      const cognitive_state = classifyCognitiveState(mastery, metacog_quality);

      // Etapa 14 — decisão de avanço
      const advance_allowed = mastery >= 80;
      const micro_reinforcement_required = mastery >= 60 && mastery < 80;

      const rigor = (sess.rigor_level as RigorLevel) ?? "standard";

      // Etapas 8-13 (síntese estruturada via IA)
      const synthesis = await synthesizeV4({
        topic: sess.topic_label ?? "",
        specialty: sess.specialty,
        rigor,
        mastery,
        confidence,
        metacog: metacog_quality,
        highYield: Number(sess.high_yield_score ?? 50),
        enamedRelevance: Number(sess.enamed_relevance ?? 50),
        recentMistakes: ((sess.metadata as any)?.recent_mistakes as string[]) ?? [],
        responses: Object.entries(byStep).map(([step, v]) => ({
          step: step as Step,
          score: v.score,
          response: v.response,
        })),
      });

      // Etapa 9 — Error Bank entries (a partir de gaps)
      const error_bank_entries = synthesis.knowledge_gaps.map((g) => ({
        topic: g.topic || sess.topic_label || "",
        subtopic: g.subtopic,
        severity: g.severity,
        source: sess.source,
      }));

      // Persiste tudo na sessão
      await sb
        .from("memory_consolidation_sessions")
        .update({
          status: "completed",
          mastery_score: mastery,
          confidence_score: confidence,
          metacog_quality,
          false_confidence_flag: false_confidence,
          cognitive_state,
          advance_allowed,
          micro_reinforcement_required,
          knowledge_gaps: synthesis.knowledge_gaps,
          fsrs_cards_to_create: synthesis.fsrs_cards_to_create,
          planner_updates: synthesis.planner_updates,
          error_bank_entries,
          enamed_takeaways: synthesis.enamed_takeaways,
          summary_text: synthesis.summary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", session_id);

      // Eventos pedagógicos
      const emitted: string[] = [];
      await emitBusEvent(sb, userId, "memory_consolidation_completed", {
        session_id,
        mastery,
        confidence,
        metacog_quality,
        cognitive_state,
        rigor,
        advance_allowed,
        study_context: { topic: sess.topic_label, specialty: sess.specialty },
      });
      emitted.push("memory_consolidation_completed");

      if (false_confidence) {
        await emitBusEvent(sb, userId, "false_confidence_detected", {
          mastery, confidence,
          study_context: { topic: sess.topic_label },
          cognitive_context: { error_pressure: (100 - mastery) / 100 },
        });
        emitted.push("false_confidence_detected");
      }

      for (const g of synthesis.knowledge_gaps) {
        await emitBusEvent(sb, userId, "knowledge_gap_detected", {
          gap: g,
          study_context: { topic: g.topic || sess.topic_label, subtopic: g.subtopic },
        });
        emitted.push("knowledge_gap_detected");
      }

      for (const p of synthesis.planner_updates) {
        await emitBusEvent(sb, userId, "review_priority_increased", {
          delta: p.delta,
          reason: p.reason,
          study_context: { topic: p.topic },
        });
        emitted.push("review_priority_increased");
      }

      // Métricas agregadas (LGPD scope=user)
      await recomputeMetrics(sb, userId, sess.topic_id, sess.topic_label);

      return corsResponse({
        memory_consolidation_completed: true,
        session_id,
        mastery_score: mastery,
        confidence_score: confidence,
        false_confidence,
        metacog_quality,
        cognitive_state,
        rigor_level: rigor,
        advance_allowed,
        micro_reinforcement_required,
        knowledge_gaps: synthesis.knowledge_gaps,
        error_bank_entries,
        fsrs_cards_to_create: synthesis.fsrs_cards_to_create,
        planner_updates: synthesis.planner_updates,
        enamed_takeaways: synthesis.enamed_takeaways,
        emitted_events: emitted,
        summary: synthesis.summary,
      });
    }

    return corsResponse({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("[memory-consolidation-v4] error", e);
    return corsResponse({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
