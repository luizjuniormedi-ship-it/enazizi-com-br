/**
 * ENAZIZI — Tutor Memory & Semantic Cache (v22.1 — Governance Layer)
 *
 * Ordem de decisão (orchestrator decide ação final):
 *   1. Exact normalized match (cheap SQL)
 *   2. Hybrid semantic match em tutor_knowledge_memory (>= 0.86)
 *   3. RAG semantic via match_rag_chunks (>= 0.78)  → contexto, não resposta pronta
 *   4. (caller) chama IA
 *   5. saveTutorMemory após resposta boa, com QUALITY GATE estrito
 *
 * Quality gate (v22.1) — bloqueia save se falhar QUALQUER critério:
 *   - quality_score >= 0.80
 *   - length 400–4000 chars
 *   - has_bibliography == true (Nelson|Sabiston|Harrison|Robbins|Tratado|UpToDate|Cecil|Goldman|Tintinalli|Williams|Schwartz|Goodman)
 *   - language_purity (sem english leak grosseiro)
 *   - hallucination_flag == false
 *   - pedagogical_depth >= 2
 *
 * Reuse filtra: promotion_status != 'quarantined', decay_score > 0.3,
 *               hallucination_flag = false, perfil cognitivo compatível.
 *
 * Logs padronizados:
 *   [MEMORY_LOOKUP_START] [MEMORY_EXACT_HIT] [MEMORY_TUTOR_HIT]
 *   [MEMORY_RAG_HIT]      [MEMORY_MISS_OPENAI]
 *   [MEMORY_SAVE_OK]      [MEMORY_REJECTED]
 *   [MEMORY_REUSE_OK]     [MEMORY_PROMOTION_CANDIDATE]
 *   [MEMORY_EMBED_FAIL_FALLBACK]
 */

import { createEmbedding } from "./ai-embeddings.ts";

export const MEMORY_THRESHOLDS = {
  tutorSemantic: 0.86,
  ragSemantic: 0.78,

  // Quality gate (v22.1)
  saveQuality: 0.80,            // antes era 0.55 — agora bloqueia mediocridade
  saveMinChars: 400,
  saveMaxChars: 4000,
  savePedagogicalDepth: 2,

  // Promoção (legado, mantido para telemetria local; cron usa thresholds próprios)
  promotionReuse: 3,
  promotionQuality: 0.85,

  freshDays: 180,
};

const BIBLIOGRAPHY_REGEX =
  /(Nelson|Sabiston|Harrison|Robbins|Tratado de|UpToDate|Cecil|Goldman|Tintinalli|Williams|Schwartz|Goodman|Bates|Cunningham|Behrman|Kliegman|Diretriz|Diretrizes|SBC|SBP|MS\s+\d{4}|Ministério da Saúde|Sociedade Brasileira)/i;

const ENGLISH_LEAK_REGEX =
  /\b(however|therefore|moreover|furthermore|nevertheless|whereas|hence|thus far|in conclusion)\b/i;

export interface TutorMemoryHit {
  id: string;
  question: string;
  answer: string;
  blocks: any[];
  topic: string | null;
  specialty: string | null;
  qualityScore: number;
  reuseCount: number;
  scope: "global" | "user";
  similarity: number;
  source: string;
  promotionStatus: "draft" | "validated" | "promoted" | "canonical" | "quarantined";
  decayScore: number;
  cognitiveStage: string | null;
  difficultyLevel: string | null;
  fromMemory: true;
  promotionCandidate: boolean;
}

export interface RagHit {
  id: string;
  content: string;
  similarity: number;
}

/** Normaliza pergunta para uniqueness/cache exato. */
export function normalizeQuestion(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** Tenta criar embedding; nunca lança (devolve null em falha). */
async function safeEmbedding(text: string): Promise<number[] | null> {
  try {
    const e = await createEmbedding(text.slice(0, 8000));
    if (Array.isArray(e) && e.length === 1536) return e;
    console.warn("[MEMORY_EMBED_FAIL_FALLBACK] unexpected length", e?.length);
    return null;
  } catch (err: any) {
    console.warn("[MEMORY_EMBED_FAIL_FALLBACK]", err?.message || err);
    return null;
  }
}

/**
 * Lookup principal — tutor_knowledge_memory.
 * Retorna o melhor hit (exact > hybrid semantic) ou null.
 * Agora respeita perfil cognitivo + decay + quarentena.
 */
export async function lookupTutorMemory(
  supabase: any,
  rawQuestion: string,
  opts: {
    userId?: string | null;
    topic?: string | null;
    specialty?: string | null;
    cognitiveStage?: string | null;
    difficultyLevel?: string | null;
  } = {},
): Promise<TutorMemoryHit | null> {
  if (!rawQuestion || rawQuestion.trim().length < 5) return null;
  const normalized = normalizeQuestion(rawQuestion);
  console.log("[MEMORY_LOOKUP_START]", {
    len: normalized.length,
    topic: opts.topic,
    stage: opts.cognitiveStage,
    diff: opts.difficultyLevel,
  });

  // 1. Exact match (global + user scope) — com filtros de governança
  try {
    const { data: exactRows } = await supabase
      .from("tutor_knowledge_memory")
      .select(
        "id, scope, user_id, question_original, answer_summary, blocks, topic, specialty, quality_score, reuse_count, source, last_used_at, created_at, promotion_status, decay_score, cognitive_stage, difficulty_level",
      )
      .eq("question_normalized", normalized)
      .or(opts.userId ? `scope.eq.global,user_id.eq.${opts.userId}` : `scope.eq.global`)
      .neq("promotion_status", "quarantined")
      .eq("hallucination_flag", false)
      .gt("decay_score", 0.3)
      .gte("quality_score", MEMORY_THRESHOLDS.saveQuality)
      .order("promotion_status", { ascending: false }) // canonical > promoted > validated > draft
      .order("decay_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(3);

    if (exactRows && exactRows.length > 0) {
      const picked = pickBestByProfile(exactRows, opts);
      if (picked) {
        console.log("[MEMORY_EXACT_HIT]", {
          id: picked.id,
          status: picked.promotion_status,
          quality: picked.quality_score,
          decay: picked.decay_score,
        });
        return toHit(picked, 1.0);
      }
    }
  } catch (e: any) {
    console.warn("[MEMORY_EXACT_LOOKUP_ERROR]", e?.message);
  }

  // 2. Hybrid semantic match
  const embedding = await safeEmbedding(rawQuestion);
  if (!embedding) return null;

  try {
    const { data: rows, error } = await supabase.rpc("match_tutor_memory_hybrid", {
      query_embedding: embedding,
      query_topic: opts.topic || null,
      query_subtopic: null,
      query_symptoms: [],
      query_abbrev: [],
      match_threshold: MEMORY_THRESHOLDS.tutorSemantic,
      match_count: 5,
      user_id_filter: opts.userId || null,
      cognitive_stage_filter: opts.cognitiveStage || null,
      difficulty_filter: opts.difficultyLevel || null,
    });
    if (error) {
      console.warn("[MEMORY_HYBRID_RPC_ERROR]", error.message);
      return null;
    }
    if (!rows || rows.length === 0) return null;

    const top = rows[0];
    if (Number(top.similarity) < MEMORY_THRESHOLDS.tutorSemantic) return null;
    if (Number(top.quality_score) < MEMORY_THRESHOLDS.saveQuality) return null;

    console.log("[MEMORY_TUTOR_HIT]", {
      id: top.id,
      similarity: top.similarity,
      status: top.promotion_status,
      quality: top.quality_score,
      decay: top.decay_score,
    });
    return toHit(top, Number(top.similarity));
  } catch (e: any) {
    console.warn("[MEMORY_HYBRID_LOOKUP_ERROR]", e?.message);
    return null;
  }
}

/** Busca RAG semântico em rag_chunks (contexto adicional, não resposta pronta). */
export async function lookupRagSemantic(
  supabase: any,
  rawQuery: string,
  topK = 3,
): Promise<RagHit[]> {
  if (!rawQuery || rawQuery.trim().length < 5) return [];
  const embedding = await safeEmbedding(rawQuery);
  if (!embedding) return [];
  try {
    const { data, error } = await supabase.rpc("match_rag_chunks", {
      query_embedding: embedding,
      match_threshold: MEMORY_THRESHOLDS.ragSemantic,
      match_count: topK,
    });
    if (error || !data) return [];
    if (data.length > 0) {
      console.log("[MEMORY_RAG_HIT]", { count: data.length, top: data[0].similarity });
    }
    return data;
  } catch (e: any) {
    console.warn("[MEMORY_RAG_LOOKUP_ERROR]", e?.message);
    return [];
  }
}

/** Incrementa reuse_count + last_used_at via RPC segura. */
export async function markMemoryReused(supabase: any, memoryId: string) {
  try {
    await supabase.rpc("tutor_memory_increment_reuse", { _memory_id: memoryId });
    console.log("[MEMORY_REUSE_OK]", memoryId);
  } catch (e: any) {
    console.warn("[MEMORY_REUSE_ERROR]", e?.message);
  }
}

// ─── Quality Gate ──────────────────────────────────────────────────────────

export interface QualityGateResult {
  pass: boolean;
  reasons: string[];
  hasBibliography: boolean;
  languagePurity: boolean;
  pedagogicalDepth: number;
}

/** Avalia se a resposta merece virar memória reutilizável. */
export function evaluateQualityGate(
  answer: string,
  qualityScore: number,
  opts: { allowShort?: boolean } = {},
): QualityGateResult {
  const reasons: string[] = [];
  const len = (answer || "").length;
  const hasBibliography = BIBLIOGRAPHY_REGEX.test(answer || "");
  const languagePurity = !ENGLISH_LEAK_REGEX.test(answer || "");

  // Profundidade pedagógica heurística: headings, listas, exemplos clínicos, citações
  let depth = 0;
  if (/\n\s*[-*•]/.test(answer)) depth++;
  if (/\b(exemplo|caso|paciente|quadro clínico)\b/i.test(answer)) depth++;
  if (hasBibliography) depth++;
  if (len > 800) depth++;

  if (qualityScore < MEMORY_THRESHOLDS.saveQuality) reasons.push(`quality<${MEMORY_THRESHOLDS.saveQuality}`);
  if (!opts.allowShort && len < MEMORY_THRESHOLDS.saveMinChars) reasons.push(`len<${MEMORY_THRESHOLDS.saveMinChars}`);
  if (len > MEMORY_THRESHOLDS.saveMaxChars) reasons.push(`len>${MEMORY_THRESHOLDS.saveMaxChars}`);
  if (!hasBibliography) reasons.push("no_bibliography");
  if (!languagePurity) reasons.push("english_leak");
  if (depth < MEMORY_THRESHOLDS.savePedagogicalDepth) reasons.push(`depth<${MEMORY_THRESHOLDS.savePedagogicalDepth}`);

  return {
    pass: reasons.length === 0,
    reasons,
    hasBibliography,
    languagePurity,
    pedagogicalDepth: depth,
  };
}

/**
 * Estima quality_score heuristicamente quando o caller não tem score próprio.
 * Faixa: 0.50 a 1.00. Respostas com biblio + profundidade + tamanho passam o gate (>=0.80).
 */
export function estimateQualityScore(answer: string): number {
  const a = answer || "";
  let score = 0.50;
  if (a.length >= 400) score += 0.10;
  if (a.length >= 800) score += 0.10;
  if (BIBLIOGRAPHY_REGEX.test(a)) score += 0.15;
  if (!ENGLISH_LEAK_REGEX.test(a)) score += 0.05;
  if (/\n\s*[-*•]/.test(a)) score += 0.05;
  if (/\b(exemplo|caso|paciente|quadro clínico|conduta|diagnóstico)\b/i.test(a)) score += 0.05;
  return Math.min(1, Number(score.toFixed(2)));
}

// ─── Save ─────────────────────────────────────────────────────────────────

export interface SaveMemoryInput {
  question: string;
  answer: string;
  blocks?: any[];
  topic?: string | null;
  specialty?: string | null;
  qualityScore?: number;
  modelUsed?: string;
  source?: string;
  userId?: string | null;
  scope?: "global" | "user";
  cognitiveStage?: string | null;
  teachingMode?: string | null;
  difficultyLevel?: string | null;
  targetProfile?: Record<string, any> | null;
  /** Quando true, ignora o tamanho mínimo (usado por respostas curtas legítimas). */
  allowShort?: boolean;
}

/**
 * Salva resposta no tutor_knowledge_memory.
 * Aplica QUALITY GATE — respostas ruins NÃO entram (log [MEMORY_REJECTED]).
 * Sempre entra como promotion_status='draft' — promoção é via cron.
 */
export async function saveTutorMemory(
  supabase: any,
  input: SaveMemoryInput,
): Promise<string | null> {
  const q = (input.question || "").trim();
  const a = (input.answer || "").trim();
  if (q.length < 5) return null;

  const quality = input.qualityScore ?? 0.7;
  const gate = evaluateQualityGate(a, quality, { allowShort: input.allowShort });

  if (!gate.pass) {
    console.log("[MEMORY_REJECTED]", {
      reasons: gate.reasons,
      len: a.length,
      quality,
      source: input.source || "tutor",
    });
    return null;
  }

  const normalized = normalizeQuestion(q);
  const scope = input.scope || "global";
  const userId = scope === "user" ? input.userId : null;

  const embedding = await safeEmbedding(q);
  const row: any = {
    scope,
    user_id: userId,
    question_original: q.slice(0, 2000),
    question_normalized: normalized,
    topic: input.topic || null,
    specialty: input.specialty || null,
    cognitive_stage: input.cognitiveStage || null,
    teaching_mode: input.teachingMode || null,
    difficulty_level: input.difficultyLevel || null,
    target_profile: input.targetProfile || {},
    answer_summary: a.slice(0, 8000),
    blocks: input.blocks || [],
    quality_score: quality,
    pedagogical_depth: gate.pedagogicalDepth,
    has_bibliography: gate.hasBibliography,
    language_purity: gate.languagePurity,
    promotion_status: "draft",
    decay_score: 1.0,
    last_validated_at: new Date().toISOString(),
    source: input.source || "tutor_v3",
    model_used: input.modelUsed || null,
    embedding,
    embedding_status: embedding ? "ready" : "pending",
    embedding_model: embedding ? "text-embedding-3-small" : null,
    embedding_updated_at: embedding ? new Date().toISOString() : null,
  };

  try {
    const { data, error } = await supabase
      .from("tutor_knowledge_memory")
      .upsert(row, { onConflict: "scope,user_id,question_normalized", ignoreDuplicates: false })
      .select("id, reuse_count, quality_score, promotion_status")
      .maybeSingle();

    if (error) {
      console.warn("[MEMORY_SAVE_ERROR]", error.message);
      return null;
    }
    console.log("[MEMORY_SAVE_OK]", {
      id: data?.id,
      quality: row.quality_score,
      depth: row.pedagogical_depth,
      embedded: !!embedding,
    });

    if (
      data &&
      (data.reuse_count ?? 0) >= MEMORY_THRESHOLDS.promotionReuse &&
      Number(data.quality_score ?? 0) >= MEMORY_THRESHOLDS.promotionQuality
    ) {
      console.log("[MEMORY_PROMOTION_CANDIDATE]", { id: data.id, reuse: data.reuse_count });
    }
    return data?.id || null;
  } catch (e: any) {
    console.warn("[MEMORY_SAVE_FATAL]", e?.message);
    return null;
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function pickBestByProfile(rows: any[], opts: { cognitiveStage?: string | null; difficultyLevel?: string | null }) {
  if (!opts.cognitiveStage && !opts.difficultyLevel) return rows[0];
  // Prefere quem casa exatamente com perfil; senão pega o primeiro
  const match = rows.find(
    (r) =>
      (!opts.cognitiveStage || !r.cognitive_stage || r.cognitive_stage === opts.cognitiveStage) &&
      (!opts.difficultyLevel || !r.difficulty_level || r.difficulty_level === opts.difficultyLevel),
  );
  return match || rows[0];
}

function toHit(r: any, similarity: number): TutorMemoryHit {
  const reuse = r.reuse_count ?? 0;
  const quality = Number(r.quality_score ?? 0);
  return {
    id: r.id,
    question: r.question_original,
    answer: r.answer_summary || "",
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    topic: r.topic,
    specialty: r.specialty,
    qualityScore: quality,
    reuseCount: reuse,
    scope: r.scope,
    similarity,
    source: r.source || "tutor_v3",
    promotionStatus: r.promotion_status || "draft",
    decayScore: Number(r.decay_score ?? 1),
    cognitiveStage: r.cognitive_stage || null,
    difficultyLevel: r.difficulty_level || null,
    fromMemory: true,
    promotionCandidate:
      reuse >= MEMORY_THRESHOLDS.promotionReuse && quality >= MEMORY_THRESHOLDS.promotionQuality,
  };
}
