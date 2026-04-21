/**
 * useCoveragePriorityMap (Fase 1.4)
 * ─────────────────────────────────
 * Lê a auditoria pedagógica já existente (`useContentCoverageAudit`) e
 * monta um Map por subtopic_id com o boost calculado pelo helper puro
 * `computeCoverageBoost`. Também expõe um Map por nome (lowercase) para
 * permitir matching defensivo no Study Engine, que não conhece IDs de
 * subtopic em todas as recomendações.
 *
 * Reusa a query existente — não dispara nada extra. Tolerante a falhas:
 * em caso de erro/dados ausentes, devolve mapas vazios e estatísticas zeradas.
 */
import { useMemo } from "react";
import { useContentCoverageAudit } from "./useContentCoverageAudit";
import {
  computeCoverageBoost,
  type CoverageBoostResult,
  type CoverageBoostLevel,
  ZERO_BOOST,
} from "@/lib/coveragePriorityBoost";

export interface CoveragePriorityEntry extends CoverageBoostResult {
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  specialtyName: string;
}

export interface CoveragePriorityStats {
  totalBoosted: number;
  byLevel: Record<CoverageBoostLevel, number>;
  bySpecialty: Array<{ specialty: string; total: number }>;
  topReasons: Array<{ reason: string; count: number }>;
}

export interface CoveragePriorityMapResult {
  loading: boolean;
  error: unknown;
  /** Map por subtopic_id */
  byId: Map<string, CoveragePriorityEntry>;
  /** Map por nome do subtopic (lowercase) — usado por matching textual */
  byName: Map<string, CoveragePriorityEntry>;
  /** Lista completa, útil para painéis. */
  entries: CoveragePriorityEntry[];
  /** Estatísticas agregadas para o painel admin. */
  stats: CoveragePriorityStats;
  /** Helper seguro: nunca lança, devolve ZERO_BOOST se não houver. */
  getById: (id: string | null | undefined) => CoverageBoostResult;
  getByName: (name: string | null | undefined) => CoverageBoostResult;
}

const EMPTY_STATS: CoveragePriorityStats = {
  totalBoosted: 0,
  byLevel: { none: 0, low: 0, medium: 0, high: 0, critical: 0 },
  bySpecialty: [],
  topReasons: [],
};

export function useCoveragePriorityMap(): CoveragePriorityMapResult {
  const { data, isLoading, error } = useContentCoverageAudit();

  return useMemo<CoveragePriorityMapResult>(() => {
    const byId = new Map<string, CoveragePriorityEntry>();
    const byName = new Map<string, CoveragePriorityEntry>();
    const entries: CoveragePriorityEntry[] = [];

    if (!data?.rows?.length) {
      return {
        loading: isLoading,
        error,
        byId,
        byName,
        entries,
        stats: EMPTY_STATS,
        getById: () => ZERO_BOOST,
        getByName: () => ZERO_BOOST,
      };
    }

    for (const r of data.rows) {
      const boost = computeCoverageBoost({
        status: r.status,
        importanceLevel: r.importance_level,
        questionsCount: r.questions_count,
        strongQuestionsCount: r.strong_questions_count,
        materialsCount: r.materials_count,
        flashcardsCount: r.flashcards_count,
        microtopicsCount: r.microtopics_count,
        bancaCoverageCount: r.banca_coverage_count,
      });
      const entry: CoveragePriorityEntry = {
        ...boost,
        subtopicId: r.subtopic_id,
        subtopicName: r.subtopic_nome,
        topicName: r.topic_nome,
        specialtyName: r.specialty_nome,
      };
      byId.set(r.subtopic_id, entry);
      const nameKey = (r.subtopic_nome || "").trim().toLowerCase();
      if (nameKey) byName.set(nameKey, entry);
      entries.push(entry);
    }

    // Stats
    const byLevel: Record<CoverageBoostLevel, number> = { none: 0, low: 0, medium: 0, high: 0, critical: 0 };
    const specMap = new Map<string, number>();
    const reasonMap = new Map<string, number>();
    let totalBoosted = 0;
    for (const e of entries) {
      byLevel[e.boostLevel] = (byLevel[e.boostLevel] ?? 0) + 1;
      if (e.boostScore > 0) {
        totalBoosted++;
        specMap.set(e.specialtyName, (specMap.get(e.specialtyName) ?? 0) + 1);
        if (e.boostReason) reasonMap.set(e.boostReason, (reasonMap.get(e.boostReason) ?? 0) + 1);
      }
    }
    const bySpecialty = Array.from(specMap.entries())
      .map(([specialty, total]) => ({ specialty, total }))
      .sort((a, b) => b.total - a.total);
    const topReasons = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const getById = (id: string | null | undefined): CoverageBoostResult => {
      if (!id) return ZERO_BOOST;
      return byId.get(id) ?? ZERO_BOOST;
    };
    const getByName = (name: string | null | undefined): CoverageBoostResult => {
      if (!name) return ZERO_BOOST;
      return byName.get(name.trim().toLowerCase()) ?? ZERO_BOOST;
    };

    return {
      loading: isLoading,
      error,
      byId,
      byName,
      entries,
      stats: { totalBoosted, byLevel, bySpecialty, topReasons },
      getById,
      getByName,
    };
  }, [data, isLoading, error]);
}
