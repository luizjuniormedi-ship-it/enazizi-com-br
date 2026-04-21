/**
 * Curriculum Bridge — compatibility layer between old curriculum_matrix
 * and new normalized curriculum_topics/subtopics/weights.
 *
 * Strategy: try new tables first, fallback to curriculum_matrix.
 *
 * STATUS: TRANSITIONAL
 * - fetchCurriculumForEngine: new tables are primary, legacy fallback still active
 * - fetchFromLegacyMatrix: @deprecated — will be removed when new tables are fully populated
 * - fetchAllCurriculumTopics: new tables are primary, legacy fallback still active
 */
import { supabase } from "@/integrations/supabase/client";

export interface NormalizedCurriculumItem {
  subtema: string;
  tema: string;
  especialidade: string;
  prioridade_base: number;
  incidencia_geral: string;
  dificuldade_base: number;
  bancaPeso: number;
  /** Fase 1.5 — IDs estruturais (presentes quando vindo das tabelas normalizadas). */
  subtopicId?: string | null;
  topicId?: string | null;
  specialtyId?: string | null;
}

const BANCA_NAME_MAP: Record<string, string> = {
  "ENARE": "ENARE",
  "USP": "USP",
  "SUS-SP": "SUS-SP",
  "UNIFESP": "UNIFESP",
  "UNICAMP": "UNICAMP",
  "AMRIGS": "AMRIGS",
  "ENAMED": "ENAMED",
};

const LEGACY_BANCA_COL: Record<string, string> = {
  "ENARE": "peso_banca_enare",
  "USP": "peso_banca_usp",
  "SUS-SP": "peso_banca_sus_sp",
  "UNICAMP": "peso_banca_unicamp",
  "UNIFESP": "peso_banca_unifesp",
};

/**
 * Fetch curriculum gaps for the Study Engine.
 * Tries new normalized tables first, falls back to curriculum_matrix.
 */
export async function fetchCurriculumForEngine(
  banca: string,
  minPriority: number = 6,
  limit: number = 80
): Promise<NormalizedCurriculumItem[]> {
  try {
    // Try new normalized curriculum first
    const bancaKey = BANCA_NAME_MAP[banca.toUpperCase()] || "ENARE";
    
    const { data: subtopics, error } = await supabase
      .from("curriculum_subtopics" as any)
      .select(`
        id,
        nome,
        prioridade_base,
        incidencia_geral,
        dificuldade_base,
        topic_id,
        curriculum_topics!inner (
          id,
          nome,
          specialty_id,
          curriculum_specialties!inner (
            id,
            nome
          )
        )
      `)
      .eq("ativo", true)
      .gte("prioridade_base", minPriority)
      .order("prioridade_base", { ascending: false })
      .limit(limit);

    if (error || !subtopics || (subtopics as any[]).length === 0) {
      throw new Error("Normalized curriculum empty, falling back");
    }

    // Get weights for this banca
    const subtopicIds = (subtopics as any[]).map((s: any) => s.id).filter(Boolean);
    let weightMap: Record<string, number> = {};
    
    if (subtopicIds.length > 0) {
      const { data: weights } = await supabase
        .from("curriculum_weights" as any)
        .select("subtopic_id, peso")
        .eq("banca", bancaKey)
        .in("subtopic_id", subtopicIds);
      
      if (weights) {
        for (const w of weights as any[]) {
          weightMap[w.subtopic_id] = w.peso;
        }
      }
    }

    return (subtopics as any[]).map((s: any) => ({
      subtema: s.nome,
      tema: s.curriculum_topics?.nome || s.nome,
      especialidade: s.curriculum_topics?.curriculum_specialties?.nome || "Geral",
      prioridade_base: s.prioridade_base || 5,
      incidencia_geral: s.incidencia_geral || "media",
      dificuldade_base: s.dificuldade_base || 3,
      bancaPeso: weightMap[s.id] || 5,
      subtopicId: s.id ?? null,
      topicId: s.curriculum_topics?.id ?? s.topic_id ?? null,
      specialtyId: s.curriculum_topics?.curriculum_specialties?.id ?? null,
    }));
  } catch {
    // Fallback to curriculum_matrix (legacy)
    return fetchFromLegacyMatrix(banca, minPriority, limit);
  }
}

/** @deprecated — Legacy fallback. Will be removed when normalized curriculum is fully populated. */
async function fetchFromLegacyMatrix(
  banca: string,
  minPriority: number,
  limit: number
): Promise<NormalizedCurriculumItem[]> {
  const col = LEGACY_BANCA_COL[banca.toUpperCase()] || "peso_banca_enare";
  
  const { data } = await supabase
    .from("curriculum_matrix")
    .select(`subtema, tema, especialidade, prioridade_base, incidencia_geral, dificuldade_base, ${col}`)
    .eq("ativo", true)
    .gte("prioridade_base", minPriority)
    .order(col, { ascending: false })
    .order("prioridade_base", { ascending: false })
    .limit(limit);

  return (data || []).map((item: any) => ({
    subtema: item.subtema,
    tema: item.tema,
    especialidade: item.especialidade,
    prioridade_base: item.prioridade_base,
    incidencia_geral: item.incidencia_geral,
    dificuldade_base: item.dificuldade_base,
    bancaPeso: item[col] || 5,
  }));
}

/**
 * Fetch all curriculum items for priority boosting.
 * Tries new tables first, falls back to curriculum_matrix.
 */
export async function fetchAllCurriculumTopics(): Promise<{ subtema: string; tema: string; especialidade: string }[]> {
  try {
    const { data, error } = await supabase
      .from("curriculum_subtopics" as any)
      .select(`
        nome,
        curriculum_topics!inner (
          nome,
          curriculum_specialties!inner (nome)
        )
      `)
      .eq("ativo", true)
      .limit(300);

    if (error || !data || (data as any[]).length === 0) {
      throw new Error("fallback");
    }

    return (data as any[]).map((s: any) => ({
      subtema: s.nome,
      tema: s.curriculum_topics?.nome || s.nome,
      especialidade: s.curriculum_topics?.curriculum_specialties?.nome || "Geral",
    }));
  } catch {
    const { data } = await supabase
      .from("curriculum_matrix")
      .select("subtema, tema, especialidade")
      .eq("ativo", true)
      .limit(300);
    return (data || []) as any[];
  }
}
