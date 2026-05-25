/**
 * ENAZIZI — Tutor Memory & Semantic Cache (v22)
 * Camada compartilhada para reaproveitar conhecimento antes de chamar OpenAI.
 *
 * Ordem de decisão:
 *   1. Exact normalized match (cheap SQL)
 *   2. Hybrid semantic match em tutor_knowledge_memory (>= 0.86)
 *   3. RAG semantic via match_rag_chunks (>= 0.78)  → contexto, não resposta pronta
 *   4. (caller) chama IA
 *   5. saveTutorMemory após resposta boa
 *
 * Logs padronizados:
 *   [MEMORY_LOOKUP_START] [MEMORY_EXACT_HIT] [MEMORY_TUTOR_HIT]
 *   [MEMORY_RAG_HIT]      [MEMORY_MISS_OPENAI]
 *   [MEMORY_SAVE_OK]      [MEMORY_REUSE_OK]
 *   [MEMORY_PROMOTION_CANDIDATE] [MEMORY_EMBED_FAIL_FALLBACK]
 */

import { createEmbedding } from "./ai-embeddings.ts";

export const MEMORY_THRESHOLDS = {
  tutorSemantic: 0.86,
  ragSemantic: 0.78,
  minQuality: 0.55,
  promotionReuse: 3,
  promotionQuality: 0.85,
  freshDays: 180,
};

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
 */
export async function lookupTutorMemory(
  supabase: any,
  rawQuestion: string,
  opts: { userId?: string | null; topic?: string | null; specialty?: string | null } = {}
): Promise<TutorMemoryHit | null> {
  if (!rawQuestion || rawQuestion.trim().length < 5) return null;
  const normalized = normalizeQuestion(rawQuestion);
  console.log("[MEMORY_LOOKUP_START]", { len: normalized.length, topic: opts.topic });

  // 1. Exact match (global + user scope)
  try {
    const { data: exactRows } = await supabase
      .from("tutor_knowledge_memory")
      .select("id, scope, user_id, question_original, answer_summary, blocks, topic, specialty, quality_score, reuse_count, source, last_used_at, created_at")
      .eq("question_normalized", normalized)
      .or(opts.userId ? `scope.eq.global,user_id.eq.${opts.userId}` : `scope.eq.global`)
      .gte("quality_score", MEMORY_THRESHOLDS.minQuality)
      .order("quality_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(1);

    if (exactRows && exactRows.length > 0) {
      const r = exactRows[0];
      console.log("[MEMORY_EXACT_HIT]", { id: r.id, quality: r.quality_score, reuse: r.reuse_count });
      return toHit(r, 1.0);
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
    });
    if (error) {
      console.warn("[MEMORY_HYBRID_RPC_ERROR]", error.message);
      return null;
    }
    if (!rows || rows.length === 0) return null;

    const top = rows[0];
    if (Number(top.similarity) < MEMORY_THRESHOLDS.tutorSemantic) return null;
    if (Number(top.quality_score) < MEMORY_THRESHOLDS.minQuality) return null;

    console.log("[MEMORY_TUTOR_HIT]", {
      id: top.id,
      similarity: top.similarity,
      quality: top.quality_score,
      reuse: top.reuse_count,
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
  topK = 3
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
}

/**
 * Salva resposta no tutor_knowledge_memory.
 * Faz upsert via unique (scope, user_id|global, question_normalized).
 * Embedding é gravado se possível; senão fica embedding_status='pending'.
 */
export async function saveTutorMemory(supabase: any, input: SaveMemoryInput): Promise<string | null> {
  const q = (input.question || "").trim();
  const a = (input.answer || "").trim();
  if (q.length < 5 || a.length < 40) return null; // resposta curta = não vale cachear

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
    answer_summary: a.slice(0, 8000),
    blocks: input.blocks || [],
    quality_score: input.qualityScore ?? 0.7,
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
      .select("id, reuse_count, quality_score")
      .maybeSingle();

    if (error) {
      console.warn("[MEMORY_SAVE_ERROR]", error.message);
      return null;
    }
    console.log("[MEMORY_SAVE_OK]", { id: data?.id, quality: row.quality_score, embedded: !!embedding });

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
    fromMemory: true,
    promotionCandidate:
      reuse >= MEMORY_THRESHOLDS.promotionReuse && quality >= MEMORY_THRESHOLDS.promotionQuality,
  };
}
