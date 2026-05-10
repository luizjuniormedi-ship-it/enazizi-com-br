import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { runAI, type AIComplexity, type AICognitiveLoad } from "../_shared/ai-runtime-orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TutorContext = {
  mission?: { title?: string } | null;
  detected_gaps?: string[] | null;
  fsrs?: { pending_reviews?: number } | null;
  cognitive_load?: number | string | null;
};

type ProviderConfig = {
  provider: "lovable-ai";
  model: string;
};

type ProviderAttempt = ProviderConfig & {
  success: boolean;
  status?: number;
  code?: string;
  message?: string;
  latency_ms: number;
};

type ProviderResult = {
  content: string;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  attempts: ProviderAttempt[];
  latencyMs: number;
};

function getGatewayKey() {
  return Deno.env.get("LOVABLE_API_KEY") ||
    Deno.env.get("AI_GATEWAY_API_KEY") ||
    Deno.env.get("LOVABLE_AI_GATEWAY_KEY") ||
    "";
}

function getEnvPresence() {
  return {
    LOVABLE_API_KEY: Boolean(Deno.env.get("LOVABLE_API_KEY")),
    OPENAI_API_KEY: Boolean(Deno.env.get("OPENAI_API_KEY")),
    GEMINI_API_KEY: Boolean(Deno.env.get("GEMINI_API_KEY")),
    AI_GATEWAY_API_KEY: Boolean(Deno.env.get("AI_GATEWAY_API_KEY")),
    LOVABLE_AI_GATEWAY_KEY: Boolean(Deno.env.get("LOVABLE_AI_GATEWAY_KEY")),
  };
}

function extractProviderError(status: number | undefined, bodyText: string, err?: unknown) {
  const fallbackMessage = err instanceof Error ? err.message : bodyText || "Provider unavailable";
  let code = status ? `HTTP_${status}` : "AI_PROVIDER_ERROR";
  let message = fallbackMessage;

  try {
    const parsed = JSON.parse(bodyText);
    const providerError = parsed?.error || parsed;
    code = providerError?.code || providerError?.type || code;
    message = providerError?.message || parsed?.message || message;
  } catch {
    if (status === 401 || status === 403) code = "AI_AUTH_ERROR";
    else if (status === 402) code = "AI_QUOTA_EXHAUSTED";
    else if (status === 404) code = "AI_MODEL_NOT_FOUND";
    else if (status === 429) code = "AI_RATE_LIMITED";
    else if (status && status >= 500) code = "AI_PROVIDER_UNAVAILABLE";
  }

  if (err instanceof DOMException && err.name === "AbortError") {
    code = "TIMEOUT";
    message = "AI provider request timed out";
  }

  return { code, message: String(message).slice(0, 300) };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function recordTutorEvent(
  supabase: any,
  input: {
    userId: string;
    sessionId: string;
    topic?: string | null;
    eventType: string;
    outcome?: string;
    payload: Record<string, unknown>;
    relatedMessageId?: string | null;
  }
) {
  try {
    const { error } = await supabase.from("tutor_events").insert({
      user_id: input.userId,
      conversation_id: input.sessionId,
      topic: input.topic || null,
      event_type: input.eventType,
      outcome: input.outcome || null,
      related_message_id: input.relatedMessageId || null,
      payload: input.payload,
    });
    if (error) console.warn("[TUTOR_V2_EVENT_LOG_FAILED]", input.eventType, error.message);
  } catch (eventError) {
    console.warn("[TUTOR_V2_EVENT_LOG_FAILED]", input.eventType, eventError instanceof Error ? eventError.message : String(eventError));
  }
}

async function callProvider(
  provider: ProviderConfig,
  gatewayKey: string,
  messages: Array<{ role: string; content: string }>,
  requestId: string,
): Promise<{ content?: string; attempt: ProviderAttempt }> {
  const attemptStart = Date.now();

  try {
    const response = await fetchWithTimeout(
      AI_GATEWAY_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: AI_MAX_TOKENS,
        }),
      },
      AI_TIMEOUT_MS,
    );

    const latency_ms = Date.now() - attemptStart;
    const responseText = await response.text();

    if (!response.ok) {
      const parsedError = extractProviderError(response.status, responseText);
      console.error("[TUTOR_V2_AI_PROVIDER_ERROR]", {
        provider: provider.provider,
        model: provider.model,
        status: response.status,
        code: parsedError.code,
        message: parsedError.message,
        requestId,
      });
      return { attempt: { ...provider, success: false, status: response.status, ...parsedError, latency_ms } };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const parsedError = { code: "AI_INVALID_JSON", message: "AI provider returned invalid JSON" };
      console.error("[TUTOR_V2_AI_PROVIDER_ERROR]", {
        provider: provider.provider,
        model: provider.model,
        status: response.status,
        code: parsedError.code,
        message: parsedError.message,
        requestId,
      });
      return { attempt: { ...provider, success: false, status: response.status, ...parsedError, latency_ms } };
    }

    const content = parsed?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      const parsedError = { code: "AI_EMPTY_RESPONSE", message: "AI provider returned no assistant content" };
      console.error("[TUTOR_V2_AI_PROVIDER_ERROR]", {
        provider: provider.provider,
        model: provider.model,
        status: response.status,
        code: parsedError.code,
        message: parsedError.message,
        requestId,
      });
      return { attempt: { ...provider, success: false, status: response.status, ...parsedError, latency_ms } };
    }

    return { content, attempt: { ...provider, success: true, status: response.status, latency_ms } };
  } catch (err) {
    const latency_ms = Date.now() - attemptStart;
    const parsedError = extractProviderError(undefined, "", err);
    console.error("[TUTOR_V2_AI_PROVIDER_ERROR]", {
      provider: provider.provider,
      model: provider.model,
      status: undefined,
      code: parsedError.code,
      message: parsedError.message,
      requestId,
    });
    return { attempt: { ...provider, success: false, ...parsedError, latency_ms } };
  }
}

// ============================================================
// QUESTION_REVIEW_MODE — Stage A (backend only, backward compatible)
// Detects medical multiple-choice / clinical-case prompts and asks
// the model to emit structured pedagogical metadata at the end.
// ============================================================

type QuestionReviewDetection = {
  active: boolean;
  signals: string[];
  detectedAlternatives: string[];
  studentAnswer: string | null;
  questionType: "multiple_choice" | "clinical_case" | "objective" | null;
};

function detectQuestionReviewMode(
  userMessage: string,
  history: Array<{ role: string; content: string }> = [],
): QuestionReviewDetection {
  const text = (userMessage || "").trim();
  const lower = text.toLowerCase();
  const signals: string[] = [];

  // Alternatives A) B) C) D) E) — at line start, with ) . - or :
  const altRegex = /(^|\n)\s*([a-eA-E])\s*[\)\.\-:]\s+\S/g;
  const detectedAlternatives = Array.from(text.matchAll(altRegex)).map((m) => m[2].toUpperCase());
  const uniqueAlts = Array.from(new Set(detectedAlternatives));
  if (uniqueAlts.length >= 3) signals.push("alternatives_detected");

  // Objective question keywords
  const objectiveKeywords = [
    "assinale", "marque", "alternativa correta", "alternativa incorreta",
    "qual das", "qual é o diagnóstico", "qual a conduta", "qual o tratamento",
    "gabarito", "questão", "enem", "enare", "usp", "unicamp", "ufrj", "amrigs", "revalida",
  ];
  if (objectiveKeywords.some((k) => lower.includes(k))) signals.push("objective_keyword");

  // Clinical case keywords
  const clinicalKeywords = [
    "paciente", "anos de idade", "evolui com", "queixa de", "história de",
    "exame físico", "ecg", "tomografia", "ressonância", "internado",
    "dor torácica", "dispneia", "febre há",
  ];
  const clinicalHits = clinicalKeywords.filter((k) => lower.includes(k));
  if (clinicalHits.length >= 2) signals.push("clinical_case");

  // "por que errei" / "errei essa"
  if (/por que errei|porque errei|errei (essa|a quest)|me explica essa quest/i.test(lower)) {
    signals.push("student_asking_correction");
  }

  // Try to detect explicit student answer "marquei B" / "respondi C"
  let studentAnswer: string | null = null;
  const ansMatch = lower.match(/(?:marquei|respondi|escolhi|minha resposta (?:foi|é)|fui na?)\s*(?:a letra\s*)?["']?([a-e])["']?/i);
  if (ansMatch) studentAnswer = ansMatch[1].toUpperCase();

  // Length floor — questions are usually long
  const longEnough = text.length >= 180;

  let active = false;
  let questionType: QuestionReviewDetection["questionType"] = null;

  if (uniqueAlts.length >= 3) {
    active = true;
    questionType = clinicalHits.length >= 2 ? "clinical_case" : "multiple_choice";
  } else if (signals.includes("objective_keyword") && longEnough) {
    active = true;
    questionType = clinicalHits.length >= 2 ? "clinical_case" : "objective";
  } else if (signals.includes("clinical_case") && longEnough && /\?/.test(text)) {
    active = true;
    questionType = "clinical_case";
  } else if (signals.includes("student_asking_correction")) {
    // Look back at last assistant/user messages for a question
    const recent = history.slice(-4).map((m) => m.content || "").join("\n");
    if (Array.from(recent.matchAll(altRegex)).length >= 3) {
      active = true;
      questionType = "multiple_choice";
      signals.push("question_in_history");
    }
  }

  return {
    active,
    signals,
    detectedAlternatives: uniqueAlts,
    studentAnswer,
    questionType,
  };
}

const QUESTION_REVIEW_INSTRUCTION = `
========================================
MODO ATIVO: QUESTION_REVIEW_MODE
========================================
A entrada do aluno contém uma QUESTÃO médica (alternativas A-E, caso clínico ou pergunta objetiva).
Você DEVE atuar como PROFESSOR CORRETOR do ENAZIZI, NÃO como expositor genérico de blocos.

ESTRUTURA OBRIGATÓRIA da resposta (em pt-BR, em ordem):
1. Tema e subtema (especialidade + tópico + competência avaliada)
2. Leitura do enunciado (o que está sendo apresentado clinicamente)
3. Resposta correta (letra + diagnóstico/conduta)
4. Por que a CORRETA está correta (com fisiopatologia/raciocínio clínico)
5. Por que CADA ERRADA está errada (comente A, B, C, D, E individualmente — só pule as que não existirem)
6. Pegadinha da banca (o erro típico que o examinador induz)
7. Raciocínio clínico passo a passo
8. Correção do raciocínio do aluno (se ele errou, explique o porquê do erro; se acertou, explique o porquê do acerto — nunca apenas "certo/errado")
9. Resumo Feynman (linguagem simples, 1-3 frases)
10. Active recall (2-3 perguntas curtas)
11. Ações recomendadas (flashcards, FSRS, error bank, planner, mnemônico, questão similar)

REGRAS:
- NÃO use os 15 blocos genéricos do modo aula. Use a estrutura acima.
- NÃO interrompa com checkpoint antes de concluir TODA a correção.
- Cite bibliografia médica (Harrison, Robbins, Sabiston, Nelson) quando relevante.
- Sem inglês solto, sem LaTeX, sem "however".

METADADOS OBRIGATÓRIOS:
Ao final da resposta (após tudo), em uma ÚNICA linha, emita:
QUESTION_REVIEW_METADATA: {"mode":"QUESTION_REVIEW_MODE","question_type":"multiple_choice|clinical_case|objective","difficulty":"easy|medium|hard","exam_style":"ENARE|USP|UNICAMP|REVALIDA|GENERIC","main_topic":"...","subtopic":"...","correct_answer":"A|B|C|D|E|null","student_answer":"A|B|C|D|E|null","is_correct":true|false|null,"trap_type":"...","reasoning_error":"...","memory_anchor":"frase curta para fixação","next_action":"revisar X / treinar Y","review_priority":"low|medium|high","fsrs_candidates":["conceito 1","conceito 2"],"error_bank_signal":{"should_create":true|false,"category":"raciocínio clínico|conceito|memória","reason":"..."},"planner_signal":{"should_suggest":true|false,"topic":"...","priority":"low|medium|high"},"suggested_actions":["create_fsrs","send_to_planner","generate_similar_question","create_mnemonic","explain_alternative_a","compare_topics"]}
`.trim();

function buildEmergencyTemplate(topic: string, userMessage: string) {
  const focus = topic || userMessage || "o tema informado";
  return `Não consegui acessar o modelo de IA agora, mas posso estruturar seu estudo com base em ${focus}.

Introdução: vamos organizar o tema em uma sequência segura para revisão médica.

Explicação leiga: pense no problema como uma cadeia de causa, mecanismo, manifestação clínica e conduta.

Técnica: identifique definição, fisiopatologia, quadro clínico, diagnóstico, tratamento e pegadinhas de prova.

Active recall:
1. Qual é a definição central de ${focus}?
2. Qual achado clínico muda a conduta?
3. Qual erro comum a banca costuma explorar?

Próxima ação: tente novamente em instantes para eu aprofundar com raciocínio adaptativo completo.`;
}

async function resolveTutorAiResponse(
  supabase: any,
  input: {
    messages: Array<{ role: string; content: string }>;
    userId: string;
    sessionId: string;
    topic: string;
    userMessage: string;
    requestId: string;
  }
): Promise<ProviderResult> {
  const gatewayKey = getGatewayKey();
  const envPresence = getEnvPresence();
  console.log("[TUTOR_V2_AI_ENV_STATUS]", envPresence);

  if (!gatewayKey) {
    await recordTutorEvent(supabase, {
      userId: input.userId,
      sessionId: input.sessionId,
      topic: input.topic,
      eventType: "ai_provider_error",
      outcome: "not_configured",
      payload: {
        provider: "lovable-ai",
        model: PRIMARY_MODEL,
        error_code: "AI_PROVIDER_NOT_CONFIGURED",
        latency_ms: 0,
        fallback_used: true,
        success: false,
        env_presence: envPresence,
        request_id: input.requestId,
      },
    });
    return {
      content: buildEmergencyTemplate(input.topic, input.userMessage),
      provider: "template",
      model: "emergency_template_response",
      fallbackUsed: true,
      attempts: [{ provider: "lovable-ai", model: PRIMARY_MODEL, success: false, code: "AI_PROVIDER_NOT_CONFIGURED", message: "O provedor de IA do Tutor não está configurado.", latency_ms: 0 }],
      latencyMs: 0,
    };
  }

  const providers: ProviderConfig[] = [
    { provider: "lovable-ai", model: PRIMARY_MODEL },
    { provider: "lovable-ai", model: FALLBACK_MODEL },
  ];

  const attempts: ProviderAttempt[] = [];
  const totalStart = Date.now();

  for (const provider of providers) {
    const result = await callProvider(provider, gatewayKey, input.messages, input.requestId);
    attempts.push(result.attempt);

    if (!result.attempt.success) {
      await recordTutorEvent(supabase, {
        userId: input.userId,
        sessionId: input.sessionId,
        topic: input.topic,
        eventType: "ai_provider_error",
        outcome: result.attempt.code || "provider_error",
        payload: {
          provider: provider.provider,
          model: provider.model,
          error_code: result.attempt.code,
          latency_ms: result.attempt.latency_ms,
          fallback_used: true,
          success: false,
          request_id: input.requestId,
        },
      });
      continue;
    }

    const fallbackUsed = attempts.length > 1;
    if (fallbackUsed) {
      await recordTutorEvent(supabase, {
        userId: input.userId,
        sessionId: input.sessionId,
        topic: input.topic,
        eventType: "ai_provider_recovered",
        outcome: "fallback_model_success",
        payload: {
          provider: provider.provider,
          model: provider.model,
          latency_ms: result.attempt.latency_ms,
          fallback_used: true,
          success: true,
          request_id: input.requestId,
        },
      });
    }

    return {
      content: result.content!,
      provider: provider.provider,
      model: provider.model,
      fallbackUsed,
      attempts,
      latencyMs: Date.now() - totalStart,
    };
  }

  await recordTutorEvent(supabase, {
    userId: input.userId,
    sessionId: input.sessionId,
    topic: input.topic,
    eventType: "ai_provider_fallback_used",
    outcome: "emergency_template_response",
    payload: {
      provider: "template",
      model: "emergency_template_response",
      error_code: attempts.at(-1)?.code || "AI_PROVIDER_UNAVAILABLE",
      latency_ms: Date.now() - totalStart,
      fallback_used: true,
      success: true,
      request_id: input.requestId,
    },
  });

  return {
    content: buildEmergencyTemplate(input.topic, input.userMessage),
    provider: "template",
    model: "emergency_template_response",
    fallbackUsed: true,
    attempts,
    latencyMs: Date.now() - totalStart,
  };
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log("[TUTOR_V2_EDGE_RECEIVED]", { method: req.method, url: req.url, requestId });
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const auth = await requireAuth(req);
    console.log("[TUTOR_V2_AUTH_STATUS]", { ok: auth.ok, userId: auth.userId, requestId });
    
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { sessionId, message } = await req.json();
    if (!sessionId || !message || typeof message !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "INVALID_REQUEST", message: "Sessão e mensagem são obrigatórias.", requestId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get Session & History
    const { data: session, error: sessionError } = await supabase
      .from("tutor_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError || !session) {
      console.error("[TUTOR_V2] Session error:", { message: sessionError?.message, requestId });
      return new Response(JSON.stringify({ ok: false, error: "SESSION_NOT_FOUND", message: "Sessão não encontrada. Por favor, inicie um novo tema.", requestId }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: history, error: historyError } = await supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("tutor_session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10);
    
    if (historyError) console.warn("[TUTOR_V2] History error:", { message: historyError.message, requestId });

    // [PHASE_0_CONTEXT] 
    let context: TutorContext = {};
    try {
      console.log("[TUTOR_V2] Calling context-builder...", { requestId });
      const { data: contextData, error: contextError } = await supabase.functions.invoke("tutor-v2-context-builder", {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (contextError) {
        console.warn("[TUTOR_V2] context-builder error:", { message: contextError.message, requestId });
      } else {
        context = contextData?.context || {};
      }
    } catch (e) {
      console.warn("[TUTOR_V2] context-builder call failed:", e instanceof Error ? e.message : String(e));
    }
    console.log("[PHASE_0_CONTEXT]", JSON.stringify(context));

    // [QUESTION_REVIEW_MODE] Stage A — detect + steer prompt (no UI changes)
    const qReview = detectQuestionReviewMode(message, history || []);
    if (qReview.active) {
      console.log("[QUESTION_REVIEW_MODE]", { signals: qReview.signals, type: qReview.questionType, requestId });
    }

    // 2. Build AI Prompt
    const systemPrompt = `${PROMPT_COMPLETO}

ESTADO COGNITIVO DO ALUNO (FASE 0):
- Tema: ${session.topic}
- Especialidade: ${session.specialty || 'Geral'}
- Missão Ativa: ${context.mission?.title || 'Exploração Livre'}
- Erros Recorrentes (Lacunas): ${context.detected_gaps?.join(', ') || 'Nenhuma detectada'}
- Status FSRS: ${context.fsrs?.pending_reviews || 0} revisões pendentes.
- Carga Cognitiva Atual: ${context.cognitive_load || 'Normal'}

INSTRUÇÃO OPERACIONAL ADAPTATIVA:
1. Aplique o Método Feynman para simplificar conceitos complexos. Use analogias.
2. Percorra as Fases Cognitivas (Leiga → Técnica → Mecanismo → Clínica → Prova → Recall → Consolidação).
3. Use bibliografia oficial (Harrison, Robbins, etc.).
4. Adote o modo de resposta obrigatório do Protocolo de 15 Blocos ENAZIZI.
5. Sempre que detectar um conceito chave, adicione FLASHCARD_SUGGESTION: {"front": "...", "back": "..."} ao final.${qReview.active ? "\n\n" + QUESTION_REVIEW_INSTRUCTION + (qReview.studentAnswer ? `\n\nResposta declarada pelo aluno: ${qReview.studentAnswer}` : "") : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    // ---- AI Runtime Orchestrator (Fase 1) ----
    const cogRaw = String(context.cognitive_load ?? "").toLowerCase();
    const cognitiveLoad: AICognitiveLoad =
      cogRaw.includes("alta") || cogRaw === "high" || Number(context.cognitive_load) >= 0.75
        ? "high"
        : cogRaw.includes("baixa") || cogRaw === "low"
        ? "low"
        : "normal";
    const msgLen = (message || "").length;
    const wantsDeep = /por que|porque|mecanismo|fisiopatolog|explica.*detalhe|aprofund|raciocínio|raciocinio/i.test(message || "");
    const wantsSimple = /resum|simples|rápido|rapido|tldr|curto/i.test(message || "");
    const baseComplexity: AIComplexity = wantsSimple ? "low" : wantsDeep || msgLen > 240 ? "high" : "medium";
    // QUESTION_REVIEW_MODE always demands clinical reasoning → force high complexity
    const complexity: AIComplexity = qReview.active ? "high" : baseComplexity;

    const providerResult = await runAI({
      taskType: qReview.active ? "clinical_reasoning" : "tutor_chat",
      specialty: session.specialty || null,
      topic: session.topic || null,
      complexity,
      cognitiveLoad,
      requiresReasoning: wantsDeep || qReview.active,
      budgetMode: "balanced",
      messages,
      userId,
      sessionId,
      requestId,
      supabase,
    });

    let assistantMessage = providerResult.content;
    const latency = Date.now() - startTime;

    // --- PEDAGOGICAL AUDIT LAYER ---
    const feynmanKeywords = ["analogia", "imagine", "simples", "como se fosse", "trocando em miúdos"];
    const hasAnalogies = feynmanKeywords.some(k => assistantMessage.toLowerCase().includes(k));
    const hasRecall = assistantMessage.toLowerCase().includes("active recall") || assistantMessage.includes("?");
    const feynmanScore = (hasAnalogies ? 50 : 0) + (hasRecall ? 50 : 0);
    console.log("[FEYNMAN_LAYER]", { analogy_used: hasAnalogies, recall_generated: hasRecall, requestId });

    const mandatoryBlocks = [
      "Introdução", "Explicação leiga", "Técnica", "Fisiologia", "Fisiopatologia", 
      "Clínica", "Sintomas", "Exame físico", "Diferencial", "Exames", 
      "Tratamento", "Pegadinhas", "Resumo", "Active recall", "Próxima ação"
    ];
    const foundBlocks = mandatoryBlocks.filter(b => assistantMessage.includes(b));
    const missingBlocks = mandatoryBlocks.filter(b => !assistantMessage.includes(b));
    const pedagogicalScore = Math.round((foundBlocks.length / mandatoryBlocks.length) * 100);
    console.log("[PEDAGOGICAL_BLOCK_VALIDATION]", { found: foundBlocks.length, missing: missingBlocks.length, requestId });

    const safetyKeywords = ["cuidado", "emergência", "urgência", "alerta", "contraindicação"];
    const hasSafetyInfo = safetyKeywords.some(k => assistantMessage.toLowerCase().includes(k));
    const hallucinationWarning = assistantMessage.length < 50 || (!hasSafetyInfo && !providerResult.fallbackUsed);

    // Extract flashcard suggestion
    let flashcardSuggestion = null;
    if (assistantMessage.includes("FLASHCARD_SUGGESTION:")) {
      const parts = assistantMessage.split("FLASHCARD_SUGGESTION:");
      assistantMessage = parts[0].trim();
      try {
        flashcardSuggestion = JSON.parse(parts[1].trim());
        console.log("[FSRS_AUTOGEN]", { cards_generated: 1, requestId });
      } catch (e) {
        console.error("[TUTOR_V2_FLASHCARD_PARSE_ERROR]", e instanceof Error ? e.message : String(e));
      }
    }

    // Extract QUESTION_REVIEW_METADATA (Stage A)
    let questionReview: any = null;
    if (assistantMessage.includes("QUESTION_REVIEW_METADATA:")) {
      const idx = assistantMessage.indexOf("QUESTION_REVIEW_METADATA:");
      const before = assistantMessage.slice(0, idx).trim();
      const after = assistantMessage.slice(idx + "QUESTION_REVIEW_METADATA:".length).trim();
      // grab JSON object — first { to matching last } on same trailing chunk
      const firstBrace = after.indexOf("{");
      const lastBrace = after.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const jsonRaw = after.slice(firstBrace, lastBrace + 1);
        try {
          questionReview = JSON.parse(jsonRaw);
          assistantMessage = before;
          console.log("[QUESTION_REVIEW_METADATA_PARSED]", {
            type: questionReview?.question_type,
            correct: questionReview?.correct_answer,
            student: questionReview?.student_answer,
            is_correct: questionReview?.is_correct,
            requestId,
          });
        } catch (e) {
          console.warn("[QUESTION_REVIEW_METADATA_PARSE_FAIL]", e instanceof Error ? e.message : String(e));
        }
      }
    }
    // If detector saw a student answer but model didn't include it, hydrate
    if (questionReview && !questionReview.student_answer && qReview.studentAnswer) {
      questionReview.student_answer = qReview.studentAnswer;
      if (questionReview.correct_answer && questionReview.is_correct == null) {
        questionReview.is_correct = questionReview.correct_answer === qReview.studentAnswer;
      }
    }

    // 3. Save Assistant Message
    const { data: savedMsg, error: saveError } = await supabase.from("tutor_messages").insert({
      tutor_session_id: sessionId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
      metadata: {
        flashcard_suggestion: flashcardSuggestion,
        question_review: questionReview,
        question_review_detection: qReview.active ? { signals: qReview.signals, type: qReview.questionType, student_answer_detected: qReview.studentAnswer } : null,
        provider: providerResult.provider,
        model: providerResult.model,
        fallback_used: providerResult.fallbackUsed,
        request_id: requestId,
        pedagogical_audit: {
          feynman_score: feynmanScore,
          pedagogical_score: pedagogicalScore,
          missing_blocks: missingBlocks
        }
      }
    }).select().single();

    if (saveError) console.warn("[TUTOR_V2_SAVE_MESSAGE_FAILED]", { message: saveError.message, requestId });

    // 4. Record Audit
    if (savedMsg) {
      await supabase.from("tutor_v2_audits").insert({
        user_id: userId,
        session_id: sessionId,
        message_id: savedMsg.id,
        phase_0_context: context,
        pedagogical_score: pedagogicalScore,
        feynman_score: feynmanScore,
        blocks_found: foundBlocks,
        blocks_missing: missingBlocks,
        hallucination_warning: hallucinationWarning,
        cognitive_load: context.cognitive_load || 0.0,
        detected_gaps: context.detected_gaps || [],
        planner_signals: [{ type: "adaptive_replan", priority: pedagogicalScore > 80 ? "low" : "high" }],
        error_signals: (qReview.active === false && missingBlocks.length > 5) ? [{ type: "pedagogical_gap", blocks: missingBlocks }] : [],
        latency_ms: latency,
        model_used: providerResult.model
      });
    }

    if (providerResult.fallbackUsed) {
      await recordTutorEvent(supabase, {
        userId,
        sessionId,
        topic: session.topic,
        eventType: "ai_provider_fallback_used",
        outcome: providerResult.model,
        relatedMessageId: savedMsg?.id || null,
        payload: {
          provider: providerResult.provider,
          model: providerResult.model,
          error_code: providerResult.attempts.find(a => !a.success)?.code || null,
          latency_ms: providerResult.latencyMs,
          fallback_used: true,
          success: true,
          request_id: requestId,
        },
      });
    }

    console.log("[TUTOR_V2_RESPONSE_SENT]", { latency, provider: providerResult.provider, model: providerResult.model, fallbackUsed: providerResult.fallbackUsed, requestId });

    return new Response(JSON.stringify({ 
      ok: true,
      success: true,
      fallback: providerResult.fallbackUsed,
      content: assistantMessage,
      message: providerResult.fallbackUsed
        ? "Não consegui acessar o modelo principal agora, mas preservei sua sessão e gerei uma resposta segura."
        : assistantMessage,
      suggestedActions: providerResult.model === "emergency_template_response" ? ["Gerar resumo", "Criar flashcards", "Tentar novamente"] : undefined,
      flashcardSuggestion,
      questionReview,
      questionReviewActive: qReview.active,
      audit: { pedagogicalScore, feynmanScore },
      provider: { name: providerResult.provider, model: providerResult.model, attempts: providerResult.attempts.map(a => ({ model: a.model, success: a.success, status: a.status, code: a.code, latency_ms: a.latency_ms })) },
      requestId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[TUTOR-V2-CHAT] Error:", error instanceof Error ? { message: error.message, stack: error.stack, requestId } : { error: String(error), requestId });
    return new Response(JSON.stringify({
      ok: false,
      error: "TUTOR_V2_INTERNAL_ERROR",
      message: "O Tutor encontrou uma falha interna controlada. Sua sessão foi preservada. Tente novamente.",
      requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
