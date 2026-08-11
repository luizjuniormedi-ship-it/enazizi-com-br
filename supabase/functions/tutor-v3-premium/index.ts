import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { classifyStudentIntent, decideTutorStep, PEDAGOGICAL_BLOCKS, TutorBlockId } from "../_shared/tutor/pedagogical-logic.ts";
import { lookupTutorMemory, lookupRagSemantic, markMemoryReused, saveTutorMemory, estimateQualityScore } from "../_shared/tutor-memory.ts";
import { decideMemoryAction } from "../_shared/memory-orchestrator.ts";
import { detectQuestionReview, buildQRInstruction, REASONING_ERROR_ENUM } from "../_shared/tutor/question-review-detector.ts";
import { normalizeTutorResponse, TutorResponse, getStaticFallback, getContextualFallback, buildTutorEnvelope } from "../_shared/ai-stability-kit.ts";
import { callClaudeV3, isClaudeV3Enabled } from "../_shared/eu-ai-v3-client.ts";
import { resolveTopicGranularity, logTopicFidelity } from "../_shared/topic-fidelity/topic-resolver.ts";
import { recordTopicFidelity } from "../_shared/topic-fidelity/telemetry.ts";
import { resolveMedicalDomain } from "../_shared/tutor/medical-ontology.ts";

// ─── LANGUAGE LEAK ENGINE v2 (False-Positive Elimination Sprint) ───────────
// Apenas vazamentos INEQUÍVOCOS. Termos médicos cognatos, mnemônicos
// internacionais e siglas científicas NÃO contam como leak.
//
// WHITELIST OFICIAL (garantida por desenho — termos abaixo NÃO estão no regex):
//   Mnemônicos     : 4Fs, Female, Forty, Fat, Fertile, MONA, ABCDE,
//                    CHA2DS2-VASc, CURB-65, SOFA, qSOFA, Wells, PERC, FAST, ATLS
//   Cardiologia    : stent, bypass, shock, guideline, NSTEMI, STEMI
//   Gastro         : cholesterol, pancreatitis, hepatitis, gallstones
//   Emergência     : sepsis, stroke, trauma
//   Pesquisa       : trial, follow-up, screening, endpoint, meta-analysis
//
// REJEITAR apenas:
//   - Caracteres CJK
//   - Termos espanhóis inequívocos (según, presentación, colelitiasis)
//   - Frases inglesas exclusivas do domínio (watchful waiting, bile salts)
//   - Marcadores internos (enamed-style, readiness score)
const LANGUAGE_LEAK_PATTERN = /[\u4e00-\u9fff]|\b(?:seg[uú]n|presentaci[oó]n|colelitiasis|watchful waiting|bile salts|enamed-style|readiness score)\b/i;
const PROVIDER_LEAK_PATTERN = /\b(?:claude|anthropic|openai|gpt-|gemini|modelo de ia|provedor)\b/i;

function detectTutorQualityIssue(content: string): string | null {
  const text = String(content || "").trim();
  const t0 = Date.now();
  console.log(`[LANGUAGE_CHECK_START] len=${text.length}`);

  if (text.length < 180) {
    console.log(`[LANGUAGE_CHECK_FAIL] reason=too_short len=${text.length}`);
    return `too_short:${text.length}`;
  }

  const langMatch = text.match(LANGUAGE_LEAK_PATTERN);
  if (langMatch) {
    console.warn(`[LANGUAGE_CHECK_FAIL] reason=language_leak matchedTerm="${langMatch[0]}" matchedRegex=LANGUAGE_LEAK_PATTERN confidence=high elapsedMs=${Date.now() - t0}`);
    console.warn(`[LANGUAGE_CHECK_MATCHES] terms=["${langMatch[0]}"]`);
    return "language_leak";
  }

  const provMatch = text.match(PROVIDER_LEAK_PATTERN);
  if (provMatch) {
    console.warn(`[LANGUAGE_CHECK_FAIL] reason=provider_leak matchedTerm="${provMatch[0]}" matchedRegex=PROVIDER_LEAK_PATTERN`);
    return "provider_leak";
  }

  console.log(`[LANGUAGE_CHECK_PASS] score=0 len=${text.length} elapsedMs=${Date.now() - t0}`);
  return null;
}



// Métrica fire-and-forget — nunca trava o fluxo.
async function bumpMetric(supabaseAdmin: any, field: string, delta = 1) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await supabaseAdmin.rpc("memory_metrics_increment", { _day: day, _field: field, _delta: delta });
  } catch (e: any) {
    console.warn("[MEMORY_METRIC_ERROR]", field, e?.message);
  }
}

// Perf-2: Timeout hard por chamada IA (defense-in-depth sobre AbortController interno)
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Perf-3: Context Budget / Token Diet helpers
function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function truncateChars(text: string, maxChars: number): string {
  const s = safeString(text);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n[TRUNCATED_FOR_LATENCY]";
}
function limitArray<T>(items: T[], maxItems: number): T[] {
  return Array.isArray(items) ? items.slice(-maxItems) : [];
}
const TUTOR_MAX_HISTORY_ITEMS = Number(Deno.env.get("TUTOR_MAX_HISTORY_ITEMS") ?? 6);
const TUTOR_MAX_HISTORY_CHARS = Number(Deno.env.get("TUTOR_MAX_HISTORY_CHARS") ?? 6000);
const TUTOR_MAX_MEMORY_CHARS = Number(Deno.env.get("TUTOR_MAX_MEMORY_CHARS") ?? 4000);
const TUTOR_MAX_RAG_CHARS = Number(Deno.env.get("TUTOR_MAX_RAG_CHARS") ?? 6000);
const TUTOR_MAX_TOTAL_CONTEXT_CHARS = Number(Deno.env.get("TUTOR_MAX_TOTAL_CONTEXT_CHARS") ?? 18000);

function trimHistoryForBudget(history: any[]): { trimmed: any[]; chars: number } {
  const limited = limitArray(history, TUTOR_MAX_HISTORY_ITEMS);
  let chars = 0;
  const out: any[] = [];
  // Walk from most recent to oldest, keeping under char budget
  for (let i = limited.length - 1; i >= 0; i--) {
    const c = safeString(limited[i]?.content);
    if (chars + c.length > TUTOR_MAX_HISTORY_CHARS) break;
    chars += c.length;
    out.unshift(limited[i]);
  }
  return { trimmed: out, chars };
}





console.log("[TUTOR_V3_BOOT] Function module loaded");

/**
 * TUTOR V3 PREMIUM — ENTERPRISE HARDENING v6
 * Final centralization and duplication cleanup.
 */
Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const { requestId, correlationId, userId } = correlation;

  // ── Latency instrumentation (Wave Perf-1) — passive, opt-in via body.debug ──
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const mark = (label: string) => {
    timings[label] = Math.round(performance.now() - t0);
  };
  const ENABLE_TIMINGS = Deno.env.get("ENABLE_TUTOR_TIMINGS") === "true";

  try {
    const body = await req.json().catch(() => ({}));
    mark("parseBodyMs");

    
    // [TUTOR_V3_OFFICIAL_CLIENT_CALL] - Requirement validation log
    console.log(`[TUTOR_V3_OFFICIAL_CLIENT_CALL] requestId=${requestId} userId=${userId}`);

    // 0. HEALTHCHECK PRE-FLIGHT
    if (body.healthcheck) {
      return corsResponse({ 
        success: true, 
        ok: true, 
        message: "Tutor V3 Premium is operational.",
        requestId 
      }, 200);
    }

    // P0-1: HARDENING AUTH GATE
    // Nenhuma requisição pedagógica deve executar sem userId válido.
    if (!userId) {
      console.warn(`[TUTOR_AUTH_FAIL] Unauthorized request to tutor-v3-premium. requestId=${requestId}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "UNAUTHORIZED",
          message: "Sessão expirada ou inválida. Por favor, faça login novamente.",
          traceId: correlationId || requestId
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    console.log(`[TUTOR_AUTH_OK] userId=${userId}`);
    const activeUserId = userId;

    const { message, sessionId, currentBlock: bodyBlock, newTopic, pedagogicalContext, stream = true, history = [] } = body;

    // ── 1. SESSION RECOVERY & HYDRATION ──────────────────────────────────────────
    let session = null;
    let topic = newTopic || pedagogicalContext?.topic || body.topic;
    
    // P0: MEDICAL DOMAIN LOCK (IAM semantic resolution)
    // Fix: If topic is provided, try to resolve its canonical version immediately.
    const medicalRes = resolveMedicalDomain(topic || message || "");
    if (medicalRes.isMedical && medicalRes.canonical) {
      console.log(`[P0_MEDICAL_LOCK] Resolved topic "${topic || message}" to canonical "${medicalRes.canonical}"`);
      topic = medicalRes.canonical;
    }
    
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (!error && data) {
        session = data;
        
        // P0: TOPIC LOCK - If session has a locked topic, prioritize it to prevent drift
        // unless a "newTopic" was explicitly provided.
        if (session.topic && !newTopic) {
          console.log(`[P0_TOPIC_LOCK] Using session locked topic: ${session.topic}`);
          topic = session.topic;
        } else if (!topic) {
          topic = session.topic;
        }
      }
    }
    mark("sessionMs");

    if (!topic) topic = "Medicina Geral";


    // ── TOPIC FIDELITY (Sprint V1 / Fase 2 — observacional, não-bloqueante) ─────
    try {
      const tfRaw = String(newTopic || body.topic || pedagogicalContext?.topic || topic || "");
      if (tfRaw) {
        const tfResult = resolveTopicGranularity(tfRaw);
        logTopicFidelity("tutor-v3-premium", tfResult);
        waitUntil?.(recordTopicFidelity(supabaseAdmin, {
          source: "tutor-v3-premium",
          userId: activeUserId,
          result: tfResult,
          metadata: { sessionId: sessionId || null, hasNewTopic: !!newTopic },
        }));
      }
    } catch (e: any) {
      console.warn("[TOPIC_FIDELITY_HOOK_ERROR]", e?.message);
    }


    // ── 1.5 QR MODE V3 (Question Review) — Fase 1.3 ─────────────────────────────
    // Detecta intent "question_review" e responde em modo corretor pedagógico.
    // Curto-circuito: bypassa 9 blocos, memória, RAG e persistência de aula.
    const qr = detectQuestionReview(body, message || "");
    if (qr.isQuestionReview) {
      console.log("[QR_MODE_ACTIVATED]", { reason: qr.reason, signals: qr.signals, partial: qr.partial });

      const qrSystemPrompt = `${PROMPT_COMPLETO}\n\n${buildQRInstruction(qr.context, qr.partial)}\n\nIMPORTANT: Respond strictly in Portuguese (pt-BR).`;
      const qrAiConfig: any = {
        taskType: "tutor_deep",
        complexity: "alta",
        userId,
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: qrSystemPrompt },
          ...history,
          { role: "user", content: message || "Por favor, corrija minha resposta para esta questão." },
        ],
      };

      let qrParsed: any = {};
      let qrRaw = "{}";
      try {
        // QR Mode tem régua de qualidade própria (enum + JSON schema).
        // Bypassa Quality Lock dos 15 blocos pedagógicos do Tutor normal.
        const qrResponse = await ai(qrAiConfig, { retries: 2, skipQualityLock: true });
        qrRaw = qrResponse.choices?.[0]?.message?.content || "{}";
        // [TEMP DIAGNOSTIC — REMOVE AFTER FASE 1.4]
        console.log("[QR_MODE_RAW]", qrRaw?.slice?.(0, 500));
        console.log("[QR_MODE_RAW_KEYS]", (() => { try { return Object.keys(JSON.parse(qrRaw)); } catch { return "PARSE_FAIL"; } })());
        qrParsed = JSON.parse(qrRaw);
      } catch (e: any) {
        console.error("[QR_MODE_PARSE_ERROR]", e?.message, qrRaw.slice(0, 200));
        qrParsed = { content: qrRaw || "Não foi possível gerar a correção agora.", metadata: null };
      }

      // Sanitização defensiva do enum
      const meta = qrParsed.metadata || {};
      if (meta.reasoning_error && !REASONING_ERROR_ENUM.includes(meta.reasoning_error)) {
        console.warn("[QR_MODE_ENUM_DRIFT]", meta.reasoning_error);
        meta.reasoning_error = "Conhecimento insuficiente";
        meta.confidence = "low";
      }
      if (qr.partial && meta.confidence !== "low") meta.confidence = "low";

      return corsResponse({
        success: true,
        ok: true,
        mode: "question_review",
        content: qrParsed.content || "Correção indisponível no momento.",
        metadata: meta,
        topic,
        correlation_id: correlationId,
        debug: { qrReason: qr.reason, qrSignals: qr.signals, qrPartial: qr.partial },
      }, 200);
    }


    // ── 2. LONGITUDINAL MEMORY SYNC ──────────────────────────────────────────────
    let memoryContext = "";
    let masteryLevel = "INITIAL";
    let recoveryMode = false;
    
    if (activeUserId && topic) {
      const { data: mem } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", activeUserId)
        .eq("topic", topic)
        .maybeSingle();
      
      if (mem) {
        masteryLevel = mem.mastery_level || "INITIAL";
        recoveryMode = masteryLevel === "RECOVERY" || (mem.comprehension_score !== null && mem.comprehension_score < 40);
        
        memoryContext = `
[MEMÓRIA COGNITIVA LONGITUDINAL]
- Nível de Domínio: ${masteryLevel}
- Erros em Provas Anteriores: ${mem.misconceptions_detected?.join(", ") || "Nenhum"}
- Blocos Teóricos já Vistos: ${mem.block_title || "Introdução"}
`;
      }
    }

    // ── 3. PEDAGOGICAL ORCHESTRATION (DETERMINISTIC) ──────────────────────
    const validBodyBlock = bodyBlock && PEDAGOGICAL_BLOCKS[bodyBlock as TutorBlockId] ? bodyBlock as TutorBlockId : null;
    const validSessionBlock = session?.current_block && PEDAGOGICAL_BLOCKS[session.current_block as TutorBlockId] ? session.current_block as TutorBlockId : null;
    const prevBlock = validBodyBlock || validSessionBlock || "BLOCO_1_MISSAO_CLINICA";
    const studentIntent = newTopic ? "new_topic" : classifyStudentIntent(message || "");
    const { nextBlock, stayInBlock, lessonComplete } = decideTutorStep(prevBlock, studentIntent);
    
    const currentBlockConfig = PEDAGOGICAL_BLOCKS[nextBlock];
    const blockObjective = currentBlockConfig.objective;

    if (lessonComplete) {
      const completionContent = `### Aula concluída ✅\n\nVocê finalizou a sequência cognitiva de **${topic}**.\n\n**Evolução real registrada:**\n- Bloco final alcançado: **Resumo de Alta Retenção**\n- Sequência pedagógica: **concluída**\n- Próxima ação recomendada: escolher novo tema, revisar erros ou gerar questões.`;

      waitUntil((async () => {
        if (activeUserId && sessionId) {
          await supabaseAdmin.from("tutor_sessions").update({
            current_block: nextBlock,
            cognitive_progress: 100,
            status: "completed",
            updated_at: new Date().toISOString(),
          }).eq("id", sessionId);

          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sessionId,
            user_id: activeUserId,
            role: "assistant",
            content: completionContent,
            metadata: {
              request_id: requestId,
              correlation_id: correlationId,
              block: nextBlock,
              blockTitle: currentBlockConfig.title,
              intent: studentIntent,
              lessonComplete: true,
              source: "lesson_completion",
            },
          });
        }
      })());

      console.log(`[TUTOR_LESSON_COMPLETE] session=${sessionId || "none"} topic=${topic}`);
      return corsResponse({
        success: true,
        ok: true,
        content: completionContent,
        teachingPhase: "AVANCAR",
        socraticQuestion: "Qual será sua próxima ação?",
        shouldWaitForStudent: true,
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        topic,
        actionsContext: { topic, block: nextBlock, lessonComplete: true },
        source: "lesson_completion",
        confidence: 1,
        lessonComplete: true,
        correlation_id: correlationId,
        debug: { studentIntent, nextBlock, lessonComplete: true, terminal: true },
      }, 200);
    }

    console.log(`[TUTOR_PEDAGOGICAL_DECISION] prev=${prevBlock} intent=${studentIntent} next=${nextBlock} lessonComplete=${!!lessonComplete}`);

    // [AI COST REDUCTION] ── HYBRID TUTOR: CHECK LOCAL KNOWLEDGE ──────────────────
    const searchTerms = [message || "", topic || ""].join(" ");
    const localFallback = getStaticFallback(searchTerms);
    
    // If we have a premium local summary and the user is asking a basic question
    if (localFallback && !localFallback.generic && (studentIntent === "doubt" || studentIntent === "new_topic") && searchTerms.length < 100) {
      console.log("[LOCAL_KNOWLEDGE_USED]", { topic: localFallback.tema });
      
      const normalizedLocal = normalizeTutorResponse(localFallback, "fallback");
      
      // AI Cost Validation: Log saved cost for local fallback
      waitUntil((async () => {
        try {
          await supabaseAdmin.from("ai_usage_logs").insert({
            user_id: activeUserId,
            model: "local_premium_fallback",
            module: "tutor-v3-premium",
            cache_status: "fallback",
            cache_hit: true,
            cost_saved: 0.01, // Est. value of a tutor call
            success: true,
            latency_ms: 5,
            prompt_type: "doubt_fallback"
          });
        } catch (e) {
          console.warn("[LOG_SAVINGS_FAIL]", (e as any)?.message);
        }
      })());

      // [FIX] Persist fallback message to ensure history consistency
      waitUntil((async () => {
        if (sessionId && activeUserId) {
          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sessionId,
            user_id: activeUserId,
            role: "assistant",
            content: normalizedLocal.content,
            metadata: { 
              request_id: requestId, 
              correlation_id: correlationId,
              block: nextBlock,
              source: "fallback",
              topic
            }
          });
        }
      })());

      return corsResponse({
        success: true,
        ok: true,
        content: normalizedLocal.content,
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        teachingPhase: normalizedLocal.teachingPhase,
        shouldWaitForStudent: true,
        socraticQuestion: normalizedLocal.socraticQuestion,
        actionsContext: { topic, block: nextBlock },
        topic,
        correlation_id: correlationId,
        source: "fallback",
        debug: { hybrid_hit: true }
      }, 200);
    }



    // ── 3.5 MEMORY LOOKUP (Tutor knowledge memory + RAG em paralelo) ────────
    // 🚨 P0 EMERGENCY BYPASS — DISABLE_TUTOR_MEMORY flag (v29 incident response)
    const MEMORY_DISABLED = (Deno.env.get("DISABLE_TUTOR_MEMORY") || "").toLowerCase() === "true";
    if (MEMORY_DISABLED) console.log("[TUTOR_SAFE_MODE] DISABLE_TUTOR_MEMORY=true — skipping memory/RAG/trace");

    const userQuestion = (message || "").trim();
    let memoryHit: Awaited<ReturnType<typeof lookupTutorMemory>> = null;
    let ragHits: Awaited<ReturnType<typeof lookupRagSemantic>> = [];

    // 🔒 Só consulta memória em perguntas substantivas. Mensagens de navegação
    // ("continue", "ok", "ave", respostas curtas a active recall, dúvidas pontuais)
    // NÃO devem reusar cache — senão a aula trava no mesmo bloco.
    const isSubstantiveQuery =
      (studentIntent === "other" || studentIntent === "new_topic") &&
      userQuestion.length >= 20;
    if (!MEMORY_DISABLED && !newTopic && isSubstantiveQuery) {
      // Lookup paralelo defensivo: memória + RAG nunca devem travar o Tutor
      try {
        const [m, r] = await Promise.all([
          lookupTutorMemory(supabaseAdmin, userQuestion, { userId: activeUserId, topic, specialty: null }),
          lookupRagSemantic(supabaseAdmin, userQuestion, 3),
        ]);
        memoryHit = m;
        ragHits = r;
      } catch (e: any) {
        console.warn("[MEMORY_LOOKUP_FAIL_SOFT]", e?.message);
        memoryHit = null;
        ragHits = [];
      }
    }
    mark("memoryLookupMs");


    if (!MEMORY_DISABLED) {
      waitUntil(bumpMetric(supabaseAdmin, "total_lookups"));
      if (ragHits.length > 0) waitUntil(bumpMetric(supabaseAdmin, "rag_hits"));
    }

    // Orchestrator decide o que fazer com o hit
    const decision = MEMORY_DISABLED
      ? { action: "regenerate_fresh" as const, reason: "safe_mode", useRagContext: false, memoryId: null as any }
      : decideMemoryAction({
          memoryHit,
          ragHits,
          userProfile: { cognitiveStage: null, difficultyLevel: null },
        });

    const useMemoryDirect = !MEMORY_DISABLED && (decision.action === "use_as_is" || decision.action === "use_with_rag");

    // Fire-and-forget orchestration trace (v23 observability)
    // Fire-and-forget orchestration trace (v23 observability) — bypass em modo seguro
    if (!MEMORY_DISABLED) {
      waitUntil((async () => {
        try {
          await supabaseAdmin.from("memory_orchestration_traces").insert({
            user_id: activeUserId,
            function_name: "tutor-v3-premium",
            question_preview: userQuestion.slice(0, 200),
            exact_hit: !!memoryHit && (memoryHit as any).matchType === "exact",
            semantic_hit: !!memoryHit && (memoryHit as any).matchType !== "exact",
            rag_hit: ragHits.length > 0,
            openai_called: !useMemoryDirect,
            memory_id: memoryHit?.id ?? null,
            orchestrator_action: decision.action,
            orchestrator_reason: decision.reason,
            similarity: memoryHit?.similarity ?? null,
            ab_compared: decision.action === "regenerate_and_compare",
          });
        } catch (e) {
          console.warn("[MEMORY_TRACE_INSERT_FAIL]", (e as any)?.message);
        }
      })());
    }

    if (useMemoryDirect && memoryHit) {
      waitUntil(bumpMetric(supabaseAdmin, decision.action === "use_as_is" ? "exact_hits" : "semantic_hits"));
      waitUntil((async () => {
        await markMemoryReused(supabaseAdmin, memoryHit!.id);
        
        // AI Cost Validation: Log cache savings
        try {
          await supabaseAdmin.from("ai_usage_logs").insert({
            user_id: activeUserId,
            model: "tutor_semantic_cache",
            module: "tutor-v3-premium",
            cache_status: "hit",
            cache_hit: true,
            cost_saved: 0.015,
            success: true,
            latency_ms: 50,
            prompt_type: "semantic_hit",
            request_id: requestId
          });
        } catch (e) {
          console.warn("[LOG_CACHE_SAVINGS_FAIL]", (e as any)?.message);
        }

        if (sessionId && activeUserId) {
          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sessionId,
            user_id: activeUserId,
            role: "assistant",
            content: memoryHit!.answer,
            metadata: {
              request_id: requestId,
              correlation_id: correlationId,
              block: nextBlock,
              fromMemory: true,
              memoryId: memoryHit!.id,
              memoryReuseCount: memoryHit!.reuseCount + 1,
              memoryQualityScore: memoryHit!.qualityScore,
              promotionStatus: memoryHit!.promotionStatus,
              orchestratorAction: decision.action,
            },
          });
        }
      })());

      // FIX: memoryHit usa shape {answer, question, ...}; adapta para o normalizer
      const normalized = normalizeTutorResponse({
        content: memoryHit.answer,
        teachingPhase: "ENSINAR",
        socraticQuestion: (memoryHit as any).socraticQuestion || `O que ficou mais claro para você sobre ${topic}?`,
        confidence: memoryHit.qualityScore ?? 0.9,
        metadata: { fromMemory: true, memoryId: memoryHit.id },
      }, "cache");
      console.log(`[TUTOR_CACHE_HIT] memoryId=${memoryHit.id}`);

      return corsResponse(buildTutorEnvelope(normalized, {
        currentBlock: nextBlock,
        blockTitle: currentBlockConfig.title,
        topic,
        correlation_id: correlationId,
        fromMemory: true,
        memoryId: memoryHit.id,
        actionsContext: { topic, block: nextBlock },
        debug: { studentIntent, nextBlock, memoryHit: true, similarity: memoryHit.similarity, action: decision.action },
      }), 200);
    }



    // ── 3.6 RAG context para enriquecer prompt quando regeneramos ───────────
    let ragContext = "";
    if (decision.useRagContext && ragHits.length > 0) {
      ragContext = "\n\n[CONTEXTO RAG RELEVANTE]\n" +
        ragHits.map((h, i) => `(${i + 1}) ${h.content.slice(0, 600)}`).join("\n---\n");
    }
    if (decision.action === "regenerate_and_compare") {
      console.log("[MEMORY_AB_REGEN_PROCEED]", { memoryId: decision.memoryId });
    }

    // Determine current block from session or decision
    const activeBlock = nextBlock;
    const activeBlockConfig = currentBlockConfig;
    const activeBlockObjective = blockObjective;


    // Determine Cost Tier for AI Routing
    let costTier: "LOW_COST" | "NORMAL" | "PREMIUM" = "NORMAL";
    if (recoveryMode || masteryLevel === "EXPERT") costTier = "PREMIUM";
    if (studentIntent === "doubt" && userQuestion.length < 50) costTier = "LOW_COST";

    // [EMERGENCY RECOVERY] If AI Routing indicates critical instability, force local fallback
    const CIRCUIT_BREAKER_FORCED = (Deno.env.get("FORCE_TUTOR_FALLBACK") || "").toLowerCase() === "true";
    if (CIRCUIT_BREAKER_FORCED) {
      console.warn("[TUTOR_CIRCUIT_BREAKER] Forced fallback active via environment");
      throw new Error("CIRCUIT_BREAKER: Forced local fallback mode");
    }


    // ── Perf-3: Context Budget / Token Diet ────────────────────────────────────
    // Trim payload sent to AI without altering prompt, persona ou pedagogia.
    const memoryContextTrimmed = truncateChars(memoryContext, TUTOR_MAX_MEMORY_CHARS);
    const ragContextTrimmed = truncateChars(ragContext, TUTOR_MAX_RAG_CHARS);
    const { trimmed: historyTrimmed, chars: historyChars } = trimHistoryForBudget(history);
    const userMessageContent = newTopic ? `Olá. Vamos iniciar o tema ${topic}.` : (message || "Continuar aula");

    const pedagogicalHeader = `${PROMPT_COMPLETO}
          
          # OBJETIVO OBRIGATÓRIO DO MOMENTO:
          Você está no ${activeBlock}: ${activeBlockConfig.title}.
          Sua missão única agora: ${activeBlockObjective}

          # REGRAS DE SAÍDA JSON:
          Você DEVE retornar um JSON com:
          {
            "content": "Sua explicação em Markdown",
            "socraticQuestion": "Uma pergunta para o aluno",
            "teachingPhase": "ENSINAR",
            "shouldWaitForStudent": true,
            "actionsContext": {
              "topic": "${topic}",
              "block": "${activeBlock}"
            }
          }
          
          TEMA ATUAL (FIXO): ${topic}
          CONTEXTO ENAMED 2026: ${JSON.stringify(body.enamedContext || {})}
          CONTESTO DE MEMÓRIA: ${memoryContextTrimmed}${ragContextTrimmed}
          
          # AVISO DE INTEGRIDADE:
          Você deve focar EXCLUSIVAMENTE em ${topic}. 
          Não desvie para outros temas (como Insuficiência Cardíaca ou Emergências Gerais) a menos que sejam diferenciais diretos.
          Toda a explicação técnica, fisiopatologia e conduta deve ser sobre ${topic}.`;

    const contextStats: Record<string, any> = {
      historyChars,
      memoryChars: memoryContextTrimmed.length,
      ragChars: ragContextTrimmed.length,
      pedagogicalChars: pedagogicalHeader.length,
      userMessageChars: userMessageContent.length,
      historyItems: historyTrimmed.length,
      memoryItems: memoryContextTrimmed ? 1 : 0,
      ragItems: Array.isArray(ragHits) ? ragHits.length : 0,
      totalInputChars: 0,
      contextTrimmed: false,
      trimReason: null as string | null,
      contract_integrity: {
        version: "V3.RESTORED",
        chars_before_transport: pedagogicalHeader.length
      }
    };
    contextStats.totalInputChars =
      contextStats.pedagogicalChars +
      contextStats.historyChars +
      contextStats.userMessageChars;

    // Corte progressivo se ainda exceder o teto total (preserva user message + bloco essencial)
    let finalSystemContent = pedagogicalHeader;
    let finalHistory = historyTrimmed;
    if (contextStats.totalInputChars > TUTOR_MAX_TOTAL_CONTEXT_CHARS) {
      contextStats.contextTrimmed = true;
      contextStats.trimReason = "exceeds_total_budget";
      // 1) drop oldest history first
      while (
        finalHistory.length > 0 &&
        contextStats.totalInputChars > TUTOR_MAX_TOTAL_CONTEXT_CHARS
      ) {
        const dropped = finalHistory.shift();
        contextStats.historyChars -= safeString(dropped?.content).length;
        contextStats.historyItems = finalHistory.length;
        contextStats.totalInputChars =
          contextStats.pedagogicalChars +
          contextStats.historyChars +
          contextStats.userMessageChars;
      }
      // 2) hard-cap system content as last resort (RAG/memory já são parte dele)
      if (contextStats.totalInputChars > TUTOR_MAX_TOTAL_CONTEXT_CHARS) {
        const overshoot = contextStats.totalInputChars - TUTOR_MAX_TOTAL_CONTEXT_CHARS;
        const newSysLen = Math.max(2000, finalSystemContent.length - overshoot);
        finalSystemContent = truncateChars(finalSystemContent, newSysLen);
        contextStats.pedagogicalChars = finalSystemContent.length;
        contextStats.totalInputChars =
          contextStats.pedagogicalChars +
          contextStats.historyChars +
          contextStats.userMessageChars;
        contextStats.trimReason = "system_hard_cap";
      }
    }

    const aiConfig: any = {
      taskType: "tutor_deep",
      complexity: "alta",
      costTier,
      userId: activeUserId,
      stream: false, // Force JSON for structured orchestration
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: finalSystemContent },
        ...finalHistory,
        { role: "user", content: userMessageContent }
      ]
    };




    console.log("[TUTOR_RUNAI_START]", { topic, qLen: userQuestion.length, action: decision.action });
    console.log("[TUTOR_CONTEXT_BUDGET]", {
      totalInputChars: contextStats.totalInputChars,
      historyItems: contextStats.historyItems,
      memoryChars: contextStats.memoryChars,
      ragChars: contextStats.ragChars,
      contextTrimmed: contextStats.contextTrimmed,
      trimReason: contextStats.trimReason,
    });
    waitUntil(bumpMetric(supabaseAdmin, "openai_calls"));
    
    const aiConfigToRun = {
      ...aiConfig,
      taskType: "tutor_chat" as any, 
      topic,
      complexity: "high" as any
    };

    // ── Caminho A: tenta Claude (eu-ai) com extrator JSON tolerante; fallback automático p/ OpenAI ──
    // Perf-2: timeout hard por provider + medição diferenciada
    const CLAUDE_TIMEOUT_MS = Number(Deno.env.get("TUTOR_CLAUDE_TIMEOUT_MS") || 9000);
    // P0 HOTFIX 2026-08-11: 9s era menor que o 1º timeout interno do gateway (openai 25s),
    // abortando a cadeia ANTES do fallback Google (que responde em ~7s). Budget agora cobre
    // openai timeout + fallback gemini.
    const OPENAI_TIMEOUT_MS = Number(Deno.env.get("TUTOR_OPENAI_TIMEOUT_MS") || 42000);
    const aiTimings: Record<string, any> = {
      providerPrimary: "unknown",
      totalAiMs: 0,
      timedOut: false,
      fallbackUsed: false,
    };

    let aiResponse: any;
    let aiProviderUsed = "openai";
    const aiStart = performance.now();
    try {
      if (isClaudeV3Enabled()) {
        aiTimings.providerPrimary = "claude";
        const sys = aiConfigToRun.messages.find((m: any) => m.role === "system")?.content || "";
        const lastUser = [...aiConfigToRun.messages].reverse().find((m: any) => m.role === "user")?.content || "";
        const primaryStart = performance.now();
        const claude = await withTimeout(
          callClaudeV3({ systemPrompt: sys, userMessage: lastUser, topic }),
          CLAUDE_TIMEOUT_MS,
          "claude",
        );
        aiTimings.primaryMs = Math.round(performance.now() - primaryStart);
        const claudeQualityIssue = detectTutorQualityIssue(claude.content);
        if (claudeQualityIssue) {
          console.warn("[TUTOR_CLAUDE_QUALITY_REJECT]", { reason: claudeQualityIssue, topic, content_len: claude.content.length });
          throw new Error(`CLAUDE_QUALITY_REJECT:${claudeQualityIssue}`);
        }
        aiResponse = {
          content: claude.content,
          socraticQuestion: claude.socraticQuestion,
          teachingPhase: claude.teachingPhase,
          shouldWaitForStudent: claude.shouldWaitForStudent,
          actionsContext: claude.actionsContext,
          model: "claude-eu",
          provider: "claude",
          usage: claude.usage,
        };
        aiProviderUsed = "claude";
        console.log("[TUTOR_CLAUDE_OK]", { latency_ms: claude._latencyMs, content_len: claude.content.length });
      } else {
        aiTimings.providerPrimary = "openai";
        throw new Error("CLAUDE_V3_DISABLED");
      }
    } catch (claudeErr: any) {
      const reason = claudeErr?.message?.slice(0, 200) || "unknown";
      const wasTimeout = reason.includes("_TIMEOUT");
      if (wasTimeout) aiTimings.timedOut = true;
      console.log("[TUTOR_CLAUDE_FALLBACK_OPENAI]", { reason, timedOut: wasTimeout });
      aiTimings.fallbackUsed = aiTimings.providerPrimary === "claude";
      aiTimings.fallbackProvider = "openai";
      const fbStart = performance.now();
      try {
        aiResponse = await withTimeout(
          ai(aiConfigToRun, { retries: 2 }),
          OPENAI_TIMEOUT_MS,
          "openai",
        );
        aiTimings.fallbackMs = Math.round(performance.now() - fbStart);
        aiProviderUsed = "openai";
      } catch (openaiErr: any) {
        aiTimings.fallbackMs = Math.round(performance.now() - fbStart);
        const fbReason = openaiErr?.message?.slice(0, 200) || "unknown";
        if (fbReason.includes("_TIMEOUT")) aiTimings.timedOut = true;
        console.warn("[TUTOR_AI_UNAVAILABLE]", { fbReason, topic });
        // Re-throw with topic context preserved for fallback
        const err = new Error(`AI_UNAVAILABLE:${fbReason}`);
        (err as any).topic = topic;
        throw err;
      }
    }
    aiTimings.totalAiMs = Math.round(performance.now() - aiStart);
    const latencyEnd = Date.now();
    mark("aiMs");
    console.log("[TUTOR_RUNAI_OK]", { provider: aiProviderUsed, totalAiMs: aiTimings.totalAiMs, fallbackUsed: aiTimings.fallbackUsed });


    // AI Cost Validation: Log actual usage
    waitUntil((async () => {
      try {
        const usage = aiResponse.usage || { prompt_tokens: 0, completion_tokens: 0 };
        await supabaseAdmin.from("ai_usage_logs").insert({
          user_id: activeUserId,
          model: aiResponse.model || "openai/gpt-5-mini",
          module: "tutor-v3-premium",
          cache_status: "miss",
          cache_hit: false,
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          tokens_used: usage.prompt_tokens + usage.completion_tokens,
          cost_estimate: ((usage.prompt_tokens / 1000000) * 0.15) + ((usage.completion_tokens / 1000000) * 0.60),
          success: true,
          latency_ms: latencyEnd - (body.startTime || Date.now()),
          request_id: requestId,
          prompt_type: "tutor_deep"
        });
      } catch (e) {
        console.warn("[LOG_USAGE_FAIL]", (e as any)?.message);
      }
    })());




    // ── 4. STABILITY & QUALITY GATE ───────────────────────────────
    const normalized = normalizeTutorResponse(aiResponse, aiProviderUsed as any);

    // P0: SEMANTIC & TOPIC VALIDATION GATE
    const isTopicValid = normalized && 
                        normalized.content && 
                        !normalized.content.toLowerCase().includes("how can i help") && 
                        !normalized.content.toLowerCase().includes("i am") &&
                        normalized.content.length > 150;

    if (!isTopicValid) {
      console.error("[P0_QUALITY_FAIL] Rejecting invalid output:", normalized?.content?.slice(0, 100));
      throw new Error("P0_SEMANTIC_INVALID_OUTPUT");
    }

    
    if (normalized.source === "fallback") {
      console.log("[TUTOR_FALLBACK_ACTIVATED]");
    }

    console.log(`[TUTOR_RESPONSE_NORMALIZED] source=${normalized.source} confidence=${normalized.confidence}`);
    
    if (!normalized.content || normalized.content.trim().length === 0) {
      console.error("[TUTOR_EMPTY_RESPONSE_BLOCKED]");
      throw new Error("Empty AI response detected after normalization");
    }
    const finalQualityIssue = detectTutorQualityIssue(normalized.content);
    if (finalQualityIssue) {
      console.error("[TUTOR_QUALITY_GATE_BLOCK]", { reason: finalQualityIssue, provider: aiProviderUsed, topic });
      throw new Error(`Tutor quality gate blocked unsafe output: ${finalQualityIssue}`);
    }

    // ── 5. IDEMPOTENT PERSISTENCE ──────────────────────────
    waitUntil((async () => {
      if (activeUserId && topic) {
        await supabaseAdmin.from("tutor_learning_memory").upsert({
          user_id: activeUserId,
          topic: topic,
          block_title: activeBlock,
          mastery_level: (normalized.metadata as any)?.mastery_level || masteryLevel,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,topic' });

        if (sessionId) {
          await supabaseAdmin.from("tutor_sessions").update({
            current_block: activeBlock,
            updated_at: new Date().toISOString()
          }).eq("id", sessionId);
        }
        
        await supabaseAdmin.from("tutor_messages").insert({
          tutor_session_id: sessionId,
          user_id: activeUserId,
          role: "assistant",
          content: normalized.content,
          metadata: { 
            request_id: requestId, 
            correlation_id: correlationId,
            block: activeBlock,
            blockTitle: activeBlockConfig.title,
            intent: studentIntent,
            socraticQuestion: normalized.socraticQuestion,
            source: normalized.source
          }
        });
      }


      // Save em tutor_knowledge_memory (LGPD-SAFE — Opção C / Hardening v25.1):
      // Toda memória nasce PRIVADA (scope='user'). Promoção para 'global' acontece
      // exclusivamente via tutor-memory-promotion-cron, que sanitiza PII antes.
      const canSaveTutorMemory =
        !MEMORY_DISABLED &&
        userQuestion.length >= 8 &&
        (normalized.content || "").length >= 60 &&
        studentIntent !== "new_topic" &&
        studentIntent !== "continue" &&
        studentIntent !== "answer_question" &&
        studentIntent !== "shortcut_summary";
      if (canSaveTutorMemory) {
        const answerText = normalized.content || "";
        const autoQuality = estimateQualityScore(answerText);
        const savedId = await saveTutorMemory(supabaseAdmin, {
          question: userQuestion,
          answer: answerText,
          blocks: (normalized.metadata as any)?.blocks || [],
          topic,
          specialty: null,
          qualityScore: autoQuality,
          modelUsed: aiResponse?.model || "openai",
          source: "tutor_v3",
          scope: "user",
          userId: activeUserId,
          teachingMode: activeBlock,
        });
        if (savedId) {
          console.log("[TUTOR_MEMORY_PRIVATE_SAVE]", { savedId, userId, topic });
          await bumpMetric(supabaseAdmin, "saves");
        } else {
          await bumpMetric(supabaseAdmin, "rejected_saves");
        }
      }
    })());


    mark("totalMs");
    const includeTimings = ENABLE_TIMINGS || body?.debug === true;
    return corsResponse(buildTutorEnvelope(normalized, {
      currentBlock: activeBlock,
      blockTitle: activeBlockConfig.title,
      topic,
      correlation_id: correlationId,
      actionsContext: (normalized.metadata as any)?.actionsContext || { topic, block: activeBlock },
      lessonComplete: !!lessonComplete,
      debug: {
        studentIntent,
        nextBlock: activeBlock,
        provider: aiProviderUsed,
        lessonComplete: !!lessonComplete,
        ...(includeTimings ? { timings, aiTimings, contextStats } : {}),
      },
    }), 200);



  } catch (err: any) {
    logger.critical("HARDENED_RUNTIME_CRASH", err.message);
    
    // P0 Fix: Use the canonical topic resolved earlier instead of default "Medicina Geral"
    const topicForFallback = (err as any).topic || topic || "Medicina Geral";
    
    console.log(`[TUTOR_SAFE_MODE] topic=${topicForFallback}`);
    const safeResponse = getContextualFallback(topicForFallback);
    
    // [FIX] Persist safe mode message
    waitUntil((async () => {
      try {
        const body = await req.clone().json().catch(() => ({}));
        const sId = body.sessionId;
        const uId = correlation.userId;
        if (sId && uId) {
          await supabaseAdmin.from("tutor_messages").insert({
            tutor_session_id: sId,
            user_id: uId,
            role: "assistant",
            content: safeResponse.content,
            metadata: { 
              request_id: requestId, 
              source: "safe_mode",
              error: err.message
            }
          });
        }
      } catch (e) {
        console.warn("[SAFE_MODE_PERSIST_FAIL]", e.message);
      }
    })());

    return corsResponse(buildTutorEnvelope(safeResponse, {
      currentBlock: "BLOCO_1_MISSAO_CLINICA",
      topic: (err as any).topic || topic || "geral",
      correlation_id: (correlation as any)?.correlationId,
      error: err.message,
      request_id: requestId,
      debug: { stage: "safe_mode_emergency" },
    }), 200);
  }


}));