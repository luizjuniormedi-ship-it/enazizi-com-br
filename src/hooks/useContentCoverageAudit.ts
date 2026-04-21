import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyCoverage, computeCoverageScore, type CoverageStatus, type ImportanceLevel } from "@/lib/coverageRules";

export interface SubtopicCoverageRow {
  subtopic_id: string;
  subtopic_nome: string;
  topic_nome: string;
  specialty_nome: string;
  importance_level: ImportanceLevel;
  questions_count: number;
  strong_questions_count: number; // links com confidence ≥ 0.85
  banca_coverage_count: number;
  max_peso: number; // maior peso entre as bancas para este subtopic
  materials_count: number;
  flashcards_count: number;
  microtopics_count: number;
  coverage_score: number; // 0–100, indicador pedagógico (Fase 1.2)
  curated_materials_count: number; // Fase 1.3: materiais com source='ai_seed' ou reviewed_by_human
  curated_flashcards_count: number; // Fase 1.3
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
  // KPIs Fase 1.1
  highImportanceWithoutQuestions: number; // muito_cobrado/cobrado com 0 Q
  totalLinks: number;
  totalStrongLinks: number;
  // KPIs Fase 1.2 (pedagogia)
  totalMaterials: number;
  totalFlashcards: number;
  totalMicrotopics: number;
  subtopicsWithoutMaterial: number;
  subtopicsWithoutFlashcard: number;
  subtopicsQuestionsButNoMaterial: number; // tem Q mas sem material → gap pedagógico
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
 * Fase 1.1: agora consome question_topic_links populados + importance_level.
 * staleTime alto (10 min): cobertura muda lentamente.
 */
export function useContentCoverageAudit() {
  return useQuery<FullAudit>({
    queryKey: ["content-coverage-audit", "v1.3"],
    queryFn: computeCoverageAudit,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

async function computeCoverageAudit(): Promise<FullAudit> {
  // 1. Hierarquia (especialidades → tópicos → subtópicos)
  const { data: subtopics } = await supabase
    .from("curriculum_subtopics" as any)
    .select(`
      id, nome, topic_id,
      curriculum_topics!inner ( id, nome, specialty_id, curriculum_specialties!inner ( id, nome ) )
    `)
    .eq("ativo", true);

  const subRows = (subtopics ?? []) as any[];
  const subIds = subRows.map((s) => s.id);

  // 2. Pesos/incidência por subtopic+banca (agora com importance_level populado)
  const { data: weights } = subIds.length
    ? await supabase
        .from("curriculum_weights" as any)
        .select("subtopic_id, banca, importance_level, peso, frequency_score, incidence_weight")
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const weightsBySub = new Map<string, any[]>();
  for (const w of (weights ?? []) as any[]) {
    const arr = weightsBySub.get(w.subtopic_id) ?? [];
    arr.push(w);
    weightsBySub.set(w.subtopic_id, arr);
  }

  // 3. Contagem real de questões via question_topic_links (Fase 1.1)
  const { data: links } = subIds.length
    ? await supabase
        .from("question_topic_links" as any)
        .select("subtopic_id, match_confidence")
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const qCountBySub = new Map<string, number>();
  const qStrongBySub = new Map<string, number>();
  for (const l of (links ?? []) as any[]) {
    if (!l.subtopic_id) continue;
    qCountBySub.set(l.subtopic_id, (qCountBySub.get(l.subtopic_id) ?? 0) + 1);
    if (l.match_confidence >= 0.85) {
      qStrongBySub.set(l.subtopic_id, (qStrongBySub.get(l.subtopic_id) ?? 0) + 1);
    }
  }

  // 3b. Materiais globais por subtopic (Fase 1.2 + 1.3 curated tracking)
  const { data: materials } = subIds.length
    ? await supabase
        .from("study_materials" as any)
        .select("subtopic_id, source, reviewed_by_human")
        .eq("is_global", true)
        .eq("ativo", true)
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const matCountBySub = new Map<string, number>();
  const matCuratedBySub = new Map<string, number>();
  for (const m of (materials ?? []) as any[]) {
    if (!m.subtopic_id) continue;
    matCountBySub.set(m.subtopic_id, (matCountBySub.get(m.subtopic_id) ?? 0) + 1);
    if (m.source === "ai_seed" || m.reviewed_by_human === true) {
      matCuratedBySub.set(m.subtopic_id, (matCuratedBySub.get(m.subtopic_id) ?? 0) + 1);
    }
  }

  // 3c. Flashcards globais por subtopic (Fase 1.2 + 1.3 curated tracking)
  const { data: flashes } = subIds.length
    ? await supabase
        .from("flashcards" as any)
        .select("subtopic_id, source, reviewed_by_human")
        .eq("is_global", true)
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const flashCountBySub = new Map<string, number>();
  const flashCuratedBySub = new Map<string, number>();
  for (const f of (flashes ?? []) as any[]) {
    if (!f.subtopic_id) continue;
    flashCountBySub.set(f.subtopic_id, (flashCountBySub.get(f.subtopic_id) ?? 0) + 1);
    if (f.source === "ai_seed" || f.reviewed_by_human === true) {
      flashCuratedBySub.set(f.subtopic_id, (flashCuratedBySub.get(f.subtopic_id) ?? 0) + 1);
    }
  }

  // 3d. Microtopics ativos por subtopic (Fase 1.2)
  const { data: micros } = subIds.length
    ? await supabase
        .from("curriculum_microtopics" as any)
        .select("subtopic_id")
        .eq("ativo", true)
        .in("subtopic_id", subIds)
    : { data: [] as any[] };

  const microCountBySub = new Map<string, number>();
  for (const mt of (micros ?? []) as any[]) {
    microCountBySub.set(mt.subtopic_id, (microCountBySub.get(mt.subtopic_id) ?? 0) + 1);
  }

  // 4. Monta linhas + classifica usando importance + materials + flashcards reais
  const rows: SubtopicCoverageRow[] = subRows.map((s) => {
    const ws = weightsBySub.get(s.id) ?? [];
    const importance = pickHighestImportance(ws);
    const maxPeso = ws.length ? Math.max(...ws.map((w) => Number(w.peso) || 0)) : 0;
    const qCount = qCountBySub.get(s.id) ?? 0;
    const qStrong = qStrongBySub.get(s.id) ?? 0;
    const matCount = matCountBySub.get(s.id) ?? 0;
    const flashCount = flashCountBySub.get(s.id) ?? 0;
    const microCount = microCountBySub.get(s.id) ?? 0;
    const verdict = classifyCoverage({
      questionsCount: Math.max(qStrong, Math.floor(qCount * 0.7)),
      bancaCoverageCount: ws.length,
      materialsCount: matCount,
      flashcardsCount: flashCount,
      importanceLevel: importance,
    });
    const score = computeCoverageScore({
      questionsCount: qCount,
      materialsCount: matCount,
      flashcardsCount: flashCount,
    });
    return {
      subtopic_id: s.id,
      subtopic_nome: s.nome,
      topic_nome: s.curriculum_topics?.nome ?? "—",
      specialty_nome: s.curriculum_topics?.curriculum_specialties?.nome ?? "—",
      importance_level: importance,
      questions_count: qCount,
      strong_questions_count: qStrong,
      banca_coverage_count: ws.length,
      max_peso: maxPeso,
      materials_count: matCount,
      flashcards_count: flashCount,
      microtopics_count: microCount,
      coverage_score: score,
      curated_materials_count: matCuratedBySub.get(s.id) ?? 0,
      curated_flashcards_count: flashCuratedBySub.get(s.id) ?? 0,
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
  const totalLinks = rows.reduce((acc, r) => acc + r.questions_count, 0);
  const totalStrong = rows.reduce((acc, r) => acc + r.strong_questions_count, 0);
  const totalMat = rows.reduce((acc, r) => acc + r.materials_count, 0);
  const totalFlash = rows.reduce((acc, r) => acc + r.flashcards_count, 0);
  const totalMicro = rows.reduce((acc, r) => acc + r.microtopics_count, 0);
  const subsNoMat = rows.filter((r) => r.materials_count === 0).length;
  const subsNoFlash = rows.filter((r) => r.flashcards_count === 0).length;
  const subsQNoMat = rows.filter((r) => r.questions_count > 0 && r.materials_count === 0).length;
  const highImpZeroQ = rows.filter(
    (r) => (r.importance_level === "muito_cobrado" || r.importance_level === "cobrado") && r.questions_count === 0,
  ).length;
  const kpis: CoverageKPIs = {
    totalSpecialties: specialties.size,
    totalTopics: topics.size,
    totalSubtopics: rows.length,
    byStatus,
    pctComplete: Math.round((byStatus.complete / total) * 100),
    pctCritical: Math.round((byStatus.critical / total) * 100),
    pctMissing: Math.round((byStatus.missing / total) * 100),
    highImportanceWithoutQuestions: highImpZeroQ,
    totalLinks,
    totalStrongLinks: totalStrong,
    totalMaterials: totalMat,
    totalFlashcards: totalFlash,
    totalMicrotopics: totalMicro,
    subtopicsWithoutMaterial: subsNoMat,
    subtopicsWithoutFlashcard: subsNoFlash,
    subtopicsQuestionsButNoMaterial: subsQNoMat,
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

  // 8. Top lacunas críticas (limit 50) — agora prioriza muito_cobrado sem questões
  const criticalGaps = rows
    .filter((r) => r.status === "critical" || r.status === "missing")
    .sort((a, b) => importanceRank(b.importance_level) - importanceRank(a.importance_level) || b.max_peso - a.max_peso)
    .slice(0, 50);

  return { rows, kpis, byDomain, byBanca, criticalGaps };
}

function pickHighestImportance(weights: any[]): ImportanceLevel {
  // Agora preferimos o enum textual já populado; se ausente, derivamos de peso.
  const order: ImportanceLevel[] = ["muito_cobrado", "cobrado", "pouco_cobrado", "raro"];
  for (const level of order) {
    if (weights.some((w) => w.importance_level === level)) return level;
  }
  // Fallback: maior peso → enum
  if (!weights.length) return null;
  const maxPeso = Math.max(...weights.map((w) => Number(w.peso) || 0));
  if (maxPeso >= 9) return "muito_cobrado";
  if (maxPeso >= 7) return "cobrado";
  if (maxPeso >= 5) return "pouco_cobrado";
  return "raro";
}

function importanceRank(level: ImportanceLevel): number {
  return { muito_cobrado: 4, cobrado: 3, pouco_cobrado: 2, raro: 1 }[level ?? ""] ?? 0;
}
