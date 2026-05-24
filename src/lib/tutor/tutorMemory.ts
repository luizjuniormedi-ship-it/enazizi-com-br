/**
 * Cliente da memória pedagógica do Tutor IA — versão híbrida (8 tiers).
 *
 * findReusableMemory implementa cascata:
 *   1. exact normalized
 *   2. topic + subtopic
 *   3. topic
 *   4. semantic similarity (RPC híbrida)
 *   5. semantic + topic overlap
 *   6. symptom overlap (DB direto via && em symptom_keywords)
 *   7. abbreviation overlap (substring no question_normalized)
 *   8. fallback high-quality same specialty
 *
 * Cada tier preserva backward compat: assinatura pública NÃO mudou.
 * Falha silenciosamente — qualquer erro retorna null e a IA continua.
 */

import { supabase } from "@/integrations/supabase/client";
import { callTutorV3 } from "./tutorClient";
import type { TutorBlock, TutorBlockType } from "@/types/tutor";
import {
  hasPersonalContext,
  normalizeTutorQuestion,
  shouldBypassMemory,
} from "./normalizeQuestion";
import {
  extractClinicalKeywords,
  extractMedicalAbbreviations,
  classifyQueryLength,
  dynamicSemanticThreshold,
} from "./clinicalConcepts";

export type TutorMemoryScope = "global" | "user";

export interface TutorMemoryRow {
  id: string;
  user_id: string | null;
  scope: TutorMemoryScope;
  question_original: string;
  question_normalized: string;
  topic: string | null;
  subtopic: string | null;
  specialty: string | null;
  intent: string | null;
  difficulty_level: string | null;
  answer_summary: string | null;
  blocks: TutorBlock[];
  block_types: string[] | null;
  symptom_keywords?: string[] | null;
  quality_score: number;
  reuse_count: number;
  source: string;
  model_used: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface FindMemoryParams {
  question: string;
  userId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  intent?: string | null;
  requiredBlockTypes?: TutorBlockType[];
  minQuality?: number;
  useSemantic?: boolean;
  /** Se omitido, calcula automaticamente conforme tamanho da pergunta. */
  semanticThreshold?: number;
}

export interface SemanticHit extends TutorMemoryRow {
  similarity: number;
  topic_overlap?: boolean;
  symptom_overlap_count?: number;
  abbreviation_overlap_count?: number;
  hybrid_score?: number;
}

export interface FindMemoryDebug {
  tier: string | null;
  semanticScore: number | null;
  hybridScore: number | null;
  topicOverlap: boolean;
  symptomOverlap: number;
  abbreviationOverlap: number;
  thresholdUsed: number | null;
  durationMs: number;
}

export interface FindMemoryResult {
  memory: TutorMemoryRow | null;
  debug: FindMemoryDebug;
}

export interface SaveMemoryParams {
  question: string;
  blocks: TutorBlock[];
  userId?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
  intent?: string | null;
  difficultyLevel?: string | null;
  answerSummary?: string | null;
  qualityScore?: number;
  modelUsed?: string | null;
  forceUserScope?: boolean;
}

const DEFAULT_MIN_QUALITY = 80;
export const MEMORY_DEGRADED_THRESHOLD = 50;

/** Pesos do score híbrido (espelho da RPC). */
export const HYBRID_WEIGHTS = {
  semantic: 0.55,
  topic: 0.2,
  symptom: 0.15,
  abbreviation: 0.1,
} as const;

/** Calcula score híbrido a partir de componentes (mesma fórmula da RPC). */
export function computeHybridMemoryScore(input: {
  similarity: number;
  topicOverlap: boolean;
  symptomOverlapCount: number;
  abbreviationOverlapCount: number;
}): number {
  const sym = Math.min(1, input.symptomOverlapCount / 3);
  const abb = Math.min(1, input.abbreviationOverlapCount / 2);
  const score =
    HYBRID_WEIGHTS.semantic * input.similarity +
    HYBRID_WEIGHTS.topic * (input.topicOverlap ? 1 : 0) +
    HYBRID_WEIGHTS.symptom * sym +
    HYBRID_WEIGHTS.abbreviation * abb;
  return Math.min(1, score);
}

const SELECT_COLS =
  "id, user_id, scope, question_original, question_normalized, topic, subtopic, specialty, intent, difficulty_level, answer_summary, blocks, block_types, symptom_keywords, quality_score, reuse_count, source, model_used, created_at, updated_at, last_used_at";

/**
 * Versão antiga mantida — retorna apenas a memória (compat).
 * Internamente delega para `findReusableMemoryDetailed`.
 */
export async function findReusableMemory(
  params: FindMemoryParams,
): Promise<TutorMemoryRow | null> {
  const result = await findReusableMemoryDetailed(params);
  return result.memory;
}

/**
 * Variante que devolve memória + debug (tier usado, scores, overlaps).
 */
export async function findReusableMemoryDetailed(
  params: FindMemoryParams,
): Promise<FindMemoryResult> {
  const startedAt = Date.now();
  const debug: FindMemoryDebug = {
    tier: null,
    semanticScore: null,
    hybridScore: null,
    topicOverlap: false,
    symptomOverlap: 0,
    abbreviationOverlap: 0,
    thresholdUsed: null,
    durationMs: 0,
  };

  const {
    question,
    userId,
    topic,
    subtopic,
    specialty,
    requiredBlockTypes,
    minQuality = DEFAULT_MIN_QUALITY,
  } = params;

  if (!question || shouldBypassMemory(question)) {
    debug.durationMs = Date.now() - startedAt;
    return { memory: null, debug };
  }

  const normalized = normalizeTutorQuestion(question);
  if (!normalized) {
    debug.durationMs = Date.now() - startedAt;
    return { memory: null, debug };
  }

  const effectiveMin = Math.max(minQuality, MEMORY_DEGRADED_THRESHOLD);

  const matchesBlockTypes = (row: TutorMemoryRow) => {
    if (!requiredBlockTypes || requiredBlockTypes.length === 0) return true;
    const types = new Set(row.block_types ?? row.blocks.map((b) => b.type));
    return requiredBlockTypes.every((t) => types.has(t));
  };

  // Tier 1: exact normalized
  try {
    const { data, error } = await supabase
      .from("tutor_knowledge_memory")
      .select(SELECT_COLS)
      .eq("question_normalized", normalized)
      .gte("quality_score", effectiveMin)
      .order("quality_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(5);

    if (!error && data) {
      const hit = (data as unknown as TutorMemoryRow[]).find(
        (r) =>
          (r.scope === "global" || (userId && r.user_id === userId)) &&
          matchesBlockTypes(r),
      );
      if (hit) {
        debug.tier = "exact_normalized";
        debug.durationMs = Date.now() - startedAt;
        return { memory: hit, debug };
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[tutorMemory] tier1 err:", e);
  }

  // Tier 2: topic + subtopic
  if (topic && subtopic) {
    try {
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", "global")
        .eq("topic", topic)
        .eq("subtopic", subtopic)
        .gte("quality_score", effectiveMin)
        .order("quality_score", { ascending: false })
        .order("reuse_count", { ascending: false })
        .limit(5);
      if (!error && data) {
        const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
        if (hit) {
          debug.tier = "topic_subtopic";
          debug.topicOverlap = true;
          debug.durationMs = Date.now() - startedAt;
          return { memory: hit, debug };
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[tutorMemory] tier2 err:", e);
    }
  }

  // Tier 3: topic
  if (topic) {
    try {
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", "global")
        .eq("topic", topic)
        .gte("quality_score", effectiveMin)
        .order("quality_score", { ascending: false })
        .order("reuse_count", { ascending: false })
        .limit(5);
      if (!error && data) {
        const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
        if (hit) {
          debug.tier = "topic";
          debug.topicOverlap = true;
          debug.durationMs = Date.now() - startedAt;
          return { memory: hit, debug };
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[tutorMemory] tier3 err:", e);
    }
  }

  // Tier 4 + 5: semantic (com possíveis overlaps já vindos do RPC híbrido)
  if (params.useSemantic) {
    const threshold =
      params.semanticThreshold ?? dynamicSemanticThreshold(question);
    debug.thresholdUsed = threshold;

    const semantic = await findSemanticMemory({
      question,
      threshold,
      matchCount: 8,
      topic,
      subtopic,
    });

    if (semantic.length > 0) {
      const top = semantic[0];
      debug.semanticScore = top.similarity ?? null;
      debug.hybridScore = top.hybrid_score ?? null;
      debug.topicOverlap = !!top.topic_overlap;
      debug.symptomOverlap = top.symptom_overlap_count ?? 0;
      debug.abbreviationOverlap = top.abbreviation_overlap_count ?? 0;

      const hit = semantic.find(
        (r) => r.quality_score >= effectiveMin && matchesBlockTypes(r),
      );
      if (hit) {
        debug.tier = hit.topic_overlap ? "semantic_with_topic" : "semantic";
        debug.durationMs = Date.now() - startedAt;
        return { memory: hit, debug };
      }
    }
  }

  // Tier 6: symptom overlap (sem embeddings — só DB)
  try {
    const symptoms = extractClinicalKeywords(question);
    if (symptoms.length > 0) {
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", "global")
        .overlaps("symptom_keywords", symptoms)
        .gte("quality_score", effectiveMin)
        .order("quality_score", { ascending: false })
        .order("reuse_count", { ascending: false })
        .limit(5);

      if (!error && data) {
        const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
        if (hit) {
          debug.tier = "symptom_overlap";
          debug.symptomOverlap = symptoms.filter((s) =>
            (hit.symptom_keywords ?? []).includes(s),
          ).length;
          debug.durationMs = Date.now() - startedAt;
          return { memory: hit, debug };
        }
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[tutorMemory] tier6 err:", e);
  }

  // Tier 7: abbreviation overlap (substring)
  try {
    const abbrev = extractMedicalAbbreviations(question);
    if (abbrev.length > 0) {
      // OR de ilike — limitado a 3 tokens para não explodir
      const tokens = abbrev.slice(0, 3);
      const orFilters = tokens
        .map((t) => `question_normalized.ilike.%${t}%`)
        .join(",");
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", "global")
        .or(orFilters)
        .gte("quality_score", effectiveMin)
        .order("quality_score", { ascending: false })
        .order("reuse_count", { ascending: false })
        .limit(5);

      if (!error && data) {
        const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
        if (hit) {
          debug.tier = "abbreviation_overlap";
          debug.abbreviationOverlap = tokens.length;
          debug.durationMs = Date.now() - startedAt;
          return { memory: hit, debug };
        }
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[tutorMemory] tier7 err:", e);
  }

  // Tier 8: fallback high-quality same specialty (>= 85)
  if (specialty) {
    try {
      const { data, error } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", "global")
        .eq("specialty", specialty)
        .gte("quality_score", 85)
        .order("quality_score", { ascending: false })
        .order("reuse_count", { ascending: false })
        .limit(3);
      if (!error && data) {
        const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
        if (hit) {
          debug.tier = "specialty_fallback";
          debug.durationMs = Date.now() - startedAt;
          return { memory: hit, debug };
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn("[tutorMemory] tier8 err:", e);
    }
  }

  debug.durationMs = Date.now() - startedAt;
  return { memory: null, debug };
}

/**
 * Busca memórias semanticamente similares via edge function `tutor-memory-search`.
 * Sempre retorna array (vazio em caso de falha).
 */
export async function findSemanticMemory(params: {
  question: string;
  threshold?: number;
  matchCount?: number;
  topic?: string | null;
  subtopic?: string | null;
}): Promise<SemanticHit[]> {
  try {
    const response = await callTutorV3({
      text: params.question,
      threshold: params.threshold,
      matchCount: params.matchCount ?? 8,
      topic: params.topic ?? null,
      subtopic: params.subtopic ?? null,
    }, {
      functionName: "tutor-memory-search",
      stream: false
    });

    const data = await response.json();
      if (import.meta.env.DEV) {
        console.warn("[tutorMemory] semantic search error:", error.message);
      }
      return [];
    }
    const hits = (data?.hits ?? []) as SemanticHit[];
    return hits;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[tutorMemory] semantic search failed:", err);
    }
    return [];
  }
}

/** Salva nova memória. */
export async function saveTutorMemory(
  params: SaveMemoryParams,
): Promise<TutorMemoryRow | null> {
  const {
    question,
    blocks,
    userId,
    topic,
    subtopic,
    specialty,
    intent,
    difficultyLevel,
    answerSummary,
    qualityScore = 70,
    modelUsed,
    forceUserScope,
  } = params;

  if (!question || !blocks || blocks.length === 0) return null;

  const normalized = normalizeTutorQuestion(question);
  if (!normalized) return null;

  const isPersonal = forceUserScope || hasPersonalContext(question) || !!userId;
  const scope: TutorMemoryScope = isPersonal && userId ? "user" : "global";

  const blockTypes = Array.from(new Set(blocks.map((b) => b.type)));

  // Pré-popula symptom_keywords (será re-confirmado pelo embedder).
  const symptomKeywords = extractClinicalKeywords(
    `${question} ${answerSummary ?? ""}`,
  );

  const payload = {
    user_id: scope === "user" ? userId : null,
    scope,
    question_original: question.slice(0, 2000),
    question_normalized: normalized,
    topic: topic ?? null,
    subtopic: subtopic ?? null,
    specialty: specialty ?? null,
    intent: intent ?? null,
    difficulty_level: difficultyLevel ?? null,
    answer_summary: answerSummary ?? null,
    blocks: blocks as never,
    block_types: blockTypes,
    symptom_keywords: symptomKeywords,
    quality_score: Math.max(0, Math.min(100, qualityScore)),
    source: "tutor_ai",
    model_used: modelUsed ?? null,
  };

  // Persistência idempotente: upsert evita 'duplicate key' em revisões repetidas.
  // O índice único cobre (scope, COALESCE(user_id, 'global'), question_normalized).
  const { data, error } = await supabase
    .from("tutor_knowledge_memory")
    .upsert([payload], {
      onConflict: "scope,user_id,question_normalized",
      ignoreDuplicates: false,
    })
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    // Fallback: tenta resgatar a linha existente para reuso/continuidade longitudinal.
    if (import.meta.env.DEV) {
      console.warn("[tutorMemory] upsert failed, attempting recovery:", error.message);
    }
    try {
      const { data: existing } = await supabase
        .from("tutor_knowledge_memory")
        .select(SELECT_COLS)
        .eq("scope", payload.scope)
        .eq("question_normalized", payload.question_normalized)
        .maybeSingle();
      if (existing) return existing as unknown as TutorMemoryRow;
    } catch { /* noop */ }
    return null;
  }

  return data as unknown as TutorMemoryRow;
}

export async function markMemoryReused(memoryId: string): Promise<void> {
  const { error } = await supabase.rpc("tutor_memory_increment_reuse", {
    _memory_id: memoryId,
  });
  if (error && import.meta.env.DEV) {
    console.warn("[tutorMemory] increment_reuse failed:", error.message);
  }
}

export async function adjustMemoryQuality(
  memoryId: string,
  delta: number,
): Promise<void> {
  const { error } = await supabase.rpc("tutor_memory_adjust_quality", {
    _memory_id: memoryId,
    _delta: delta,
  });
  if (error && import.meta.env.DEV) {
    console.warn("[tutorMemory] adjust_quality failed:", error.message);
  }
}

// Re-exports para conveniência
export {
  extractClinicalKeywords,
  extractMedicalAbbreviations,
  classifyQueryLength,
  dynamicSemanticThreshold,
};
