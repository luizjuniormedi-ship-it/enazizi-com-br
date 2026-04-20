import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyCoverage, type CoverageStatus, type ImportanceLevel } from "@/lib/coverageRules";

export interface SubtopicCoverageRow {
  subtopic_id: string;
  subtopic_nome: string;
  topic_nome: string;
  specialty_nome: string;
  importance_level: ImportanceLevel;
  questions_count: number;
  banca_coverage_count: number;
  materials_count: number;
  flashcards_count: number;
  status: CoverageStatus;
  rule: string;
  reason: string;
}

export interface CoverageKPIs {
  totalSpecialties: number;
  totalTopics: number;
  totalSubtopics: number;
  byStatus: Record<CoverageStatus, number>;
  pctComplete: number;
  pctCritical: number;
  pctMissing: number;
}

export interface CoverageByDomain {
  specialty: string;
  totalSubtopics: number;
  complete: number;
  partial: number;
  critical: number;
  missing: number;
  pctComplete: number;
}

export interface CoverageByBanca {
  banca: string;
  totalMapped: number;
  totalWithQuestions: number;
  gaps: number;
  pctCovered: number;
}

interface FullAudit {
  rows: SubtopicCoverageRow[];
  kpis: CoverageKPIs;
  byDomain: CoverageByDomain[];
  byBanca: CoverageByBanca[];
  criticalGaps: SubtopicCoverageRow[];
}

/**
 * useContentCoverageAudit
 * Computa, em runtime, o estado de cobertura completo do acervo.
 * Sem persistir snapshot ainda — leitura direta + agregação leve.
 * staleTime alto (10 min): cobertura muda lentamente.
 */
export function useContentCoverageAudit() {
  return useQuery<FullAudit>({
    queryKey: ["content-coverage-audit"],
    queryFn: computeCoverageAudit,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

async function computeCoverageAudit(): Promise<FullAudit> {
  // 1. Carrega hierarquia (especialidades → tópicos → subtópicos)
  const { data: subtopics } = await supabase
    .from("curriculum_subtopics" as any)
    .select(`
      id, nome, topic_id,
      curriculum_topics!inner ( id, nome, specialty_id, curriculum_specialties!inner ( id, nome ) )
    `)
    .eq("ativo", true);

  const subRows = (subtopics ?? []) as any[];
  const subIds = subRows.map((s) => s.id);

  // 2. Pesos/incidência por subtopic+banca
  const { data: weights } = subIds.length
    ? await supabase
        .from("curriculum_weights" as any)
        .select("subtopic_id, banca, importance_level, peso")
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const weightsBySub = new Map<string, any[]>();
  for (const w of (weights ?? []) as any[]) {
    const arr = weightsBySub.get(w.subtopic_id) ?? [];
    arr.push(w);
    weightsBySub.set(w.subtopic_id, arr);
  }

  // 3. Contagem de questões via tabela de junção
  const { data: links } = subIds.length
    ? await supabase
        .from("question_topic_links" as any)
        .select("subtopic_id")
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const qCountBySub = new Map<string, number>();
  for (const l of (links ?? []) as any[]) {
    if (!l.subtopic_id) continue;
    qCountBySub.set(l.subtopic_id, (qCountBySub.get(l.subtopic_id) ?? 0) + 1);
  }

  // 4. Monta linhas + classifica
  const rows: SubtopicCoverageRow[] = subRows.map((s) => {
    const ws = weightsBySub.get(s.id) ?? [];
    const importance = pickHighestImportance(ws);
    const verdict = classifyCoverage({
      questionsCount: qCountBySub.get(s.id) ?? 0,
      bancaCoverageCount: ws.length,
      materialsCount: 0, // placeholder — materiais pedagógicos serão integrados em fase futura
      flashcardsCount: 0,
      importanceLevel: importance,
    });
    return {
      subtopic_id: s.id,
      subtopic_nome: s.nome,
      topic_nome: s.curriculum_topics?.nome ?? "—",
      specialty_nome: s.curriculum_topics?.curriculum_specialties?.nome ?? "—",
      importance_level: importance,
      questions_count: qCountBySub.get(s.id) ?? 0,
      banca_coverage_count: ws.length,
      materials_count: 0,
      flashcards_count: 0,
      status: verdict.status,
      rule: verdict.rule,
      reason: verdict.reason,
    };
  });

  // 5. KPIs globais
  const byStatus: Record<CoverageStatus, number> = { complete: 0, partial: 0, critical: 0, missing: 0 };
  for (const r of rows) byStatus[r.status]++;
  const total = Math.max(rows.length, 1);
  const specialties = new Set(rows.map((r) => r.specialty_nome));
  const topics = new Set(rows.map((r) => `${r.specialty_nome}::${r.topic_nome}`));
  const kpis: CoverageKPIs = {
    totalSpecialties: specialties.size,
    totalTopics: topics.size,
    totalSubtopics: rows.length,
    byStatus,
    pctComplete: Math.round((byStatus.complete / total) * 100),
    pctCritical: Math.round((byStatus.critical / total) * 100),
    pctMissing: Math.round((byStatus.missing / total) * 100),
  };

  // 6. Agregação por domínio (especialidade)
  const domMap = new Map<string, CoverageByDomain>();
  for (const r of rows) {
    const cur = domMap.get(r.specialty_nome) ?? {
      specialty: r.specialty_nome, totalSubtopics: 0, complete: 0, partial: 0, critical: 0, missing: 0, pctComplete: 0,
    };
    cur.totalSubtopics++;
    cur[r.status]++;
    domMap.set(r.specialty_nome, cur);
  }
  const byDomain = Array.from(domMap.values()).map((d) => ({
    ...d,
    pctComplete: Math.round((d.complete / Math.max(d.totalSubtopics, 1)) * 100),
  })).sort((a, b) => a.pctComplete - b.pctComplete);

  // 7. Agregação por banca
  const bancaMap = new Map<string, { mapped: Set<string>; withQ: Set<string> }>();
  for (const w of (weights ?? []) as any[]) {
    const b = w.banca as string;
    const cur = bancaMap.get(b) ?? { mapped: new Set(), withQ: new Set() };
    cur.mapped.add(w.subtopic_id);
    if ((qCountBySub.get(w.subtopic_id) ?? 0) > 0) cur.withQ.add(w.subtopic_id);
    bancaMap.set(b, cur);
  }
  const byBanca: CoverageByBanca[] = Array.from(bancaMap.entries()).map(([banca, v]) => ({
    banca,
    totalMapped: v.mapped.size,
    totalWithQuestions: v.withQ.size,
    gaps: v.mapped.size - v.withQ.size,
    pctCovered: Math.round((v.withQ.size / Math.max(v.mapped.size, 1)) * 100),
  })).sort((a, b) => a.pctCovered - b.pctCovered);

  // 8. Top lacunas críticas (limit 50)
  const criticalGaps = rows
    .filter((r) => r.status === "critical" || r.status === "missing")
    .sort((a, b) => importanceRank(b.importance_level) - importanceRank(a.importance_level))
    .slice(0, 50);

  return { rows, kpis, byDomain, byBanca, criticalGaps };
}

function pickHighestImportance(weights: any[]): ImportanceLevel {
  const order: ImportanceLevel[] = ["muito_cobrado", "cobrado", "pouco_cobrado", "raro"];
  for (const level of order) {
    if (weights.some((w) => w.importance_level === level)) return level;
  }
  return null;
}

function importanceRank(level: ImportanceLevel): number {
  return { muito_cobrado: 4, cobrado: 3, pouco_cobrado: 2, raro: 1 }[level ?? ""] ?? 0;
}
