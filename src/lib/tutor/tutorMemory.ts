/**
 * Cliente da memória pedagógica do Tutor IA.
 *
 * Encapsula busca, salvamento e ajustes de qualidade na tabela
 * `tutor_knowledge_memory`. Toda a lógica de "reutilizar vs gerar"
 * fica aqui — o componente de chat só pergunta `findReusableMemory()`
 * antes de chamar a edge function.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TutorBlock, TutorBlockType } from "@/types/tutor";
import {
  hasPersonalContext,
  normalizeTutorQuestion,
  shouldBypassMemory,
} from "./normalizeQuestion";

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
  intent?: string | null;
  /** Tipos de bloco mínimos esperados na resposta (ex: ["clinical_flow"]). */
  requiredBlockTypes?: TutorBlockType[];
  /** quality_score mínimo para considerar reutilizável. */
  minQuality?: number;
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
  /** Força salvar como pessoal mesmo sem contexto sensível detectado. */
  forceUserScope?: boolean;
}

const DEFAULT_MIN_QUALITY = 80;

/**
 * Procura memória reutilizável. Retorna `null` se nada qualificar.
 *
 * Estratégia de busca (em ordem):
 *   1. pergunta normalizada idêntica (user_id OU global)
 *   2. mesmo topic + subtopic (global, melhor quality_score)
 *   3. mesmo topic (global, melhor quality_score)
 */
export async function findReusableMemory(
  params: FindMemoryParams,
): Promise<TutorMemoryRow | null> {
  const {
    question,
    userId,
    topic,
    subtopic,
    requiredBlockTypes,
    minQuality = DEFAULT_MIN_QUALITY,
  } = params;

  if (!question || shouldBypassMemory(question)) return null;

  const normalized = normalizeTutorQuestion(question);
  if (!normalized) return null;

  // Helper: filtra por tipos de bloco requeridos
  const matchesBlockTypes = (row: TutorMemoryRow) => {
    if (!requiredBlockTypes || requiredBlockTypes.length === 0) return true;
    const types = new Set(row.block_types ?? row.blocks.map((b) => b.type));
    return requiredBlockTypes.every((t) => types.has(t));
  };

  // 1) match exato por pergunta normalizada
  {
    const { data, error } = await supabase
      .from("tutor_knowledge_memory")
      .select("*")
      .eq("question_normalized", normalized)
      .gte("quality_score", minQuality)
      .order("quality_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(5);

    if (!error && data) {
      const hit = (data as unknown as TutorMemoryRow[]).find(
        (r) =>
          (r.scope === "global" || (userId && r.user_id === userId)) &&
          matchesBlockTypes(r),
      );
      if (hit) return hit;
    }
  }

  // 2) match por topic + subtopic
  if (topic && subtopic) {
    const { data, error } = await supabase
      .from("tutor_knowledge_memory")
      .select("*")
      .eq("scope", "global")
      .eq("topic", topic)
      .eq("subtopic", subtopic)
      .gte("quality_score", minQuality)
      .order("quality_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(5);

    if (!error && data) {
      const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
      if (hit) return hit;
    }
  }

  // 3) match por topic
  if (topic) {
    const { data, error } = await supabase
      .from("tutor_knowledge_memory")
      .select("*")
      .eq("scope", "global")
      .eq("topic", topic)
      .gte("quality_score", minQuality)
      .order("quality_score", { ascending: false })
      .order("reuse_count", { ascending: false })
      .limit(5);

    if (!error && data) {
      const hit = (data as unknown as TutorMemoryRow[]).find(matchesBlockTypes);
      if (hit) return hit;
    }
  }

  return null;
}

/**
 * Salva uma nova memória pedagógica. Decide automaticamente o escopo:
 * `user` se a pergunta tem contexto pessoal ou se `forceUserScope=true`,
 * caso contrário `global`.
 *
 * Globais só são aceitas pelo banco se o usuário for admin (RLS).
 * Para a maioria dos alunos, salvamos como `user`.
 */
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
    blocks: blocks as unknown as Record<string, unknown>[],
    block_types: blockTypes,
    quality_score: Math.max(0, Math.min(100, qualityScore)),
    source: "tutor_ai",
    model_used: modelUsed ?? null,
  };

  const { data, error } = await supabase
    .from("tutor_knowledge_memory")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[tutorMemory] failed to save:", error.message);
    }
    return null;
  }

  return data as unknown as TutorMemoryRow;
}

/**
 * Marca uma memória como reutilizada (incrementa reuse_count + last_used_at).
 */
export async function markMemoryReused(memoryId: string): Promise<void> {
  const { error } = await supabase.rpc("tutor_memory_increment_reuse", {
    _memory_id: memoryId,
  });
  if (error && import.meta.env.DEV) {
    console.warn("[tutorMemory] increment_reuse failed:", error.message);
  }
}

/**
 * Ajusta a pontuação de qualidade (delta positivo ou negativo).
 *
 * Eventos sugeridos:
 *  - aluno curtiu resposta:        +5
 *  - mini quiz acertado:           +3
 *  - aluno pediu reformulação:    -10
 *  - mini quiz errado repetido:    -5
 */
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
