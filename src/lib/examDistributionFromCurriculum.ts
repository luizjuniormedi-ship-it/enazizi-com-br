/**
 * Service de distribuição dinâmica de temas baseado em `curriculum_weights`.
 *
 * Estratégia:
 *  1. Lê pesos por subtopic da banca alvo.
 *  2. Agrupa em 3 níveis (specialty → topic → subtopic), agregando pesos.
 *  3. Aplica agrupamento virtual de "Clínica Médica" (UX híbrida).
 *  4. Normaliza pesos para % e converte em quantidade de questões.
 *  5. Corrige arredondamento para fechar o total exato no nível raiz.
 *  6. Se a banca não tiver dados suficientes, devolve fallback estático
 *     compatível com o consumidor.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  profileToCurriculumBanca,
  CLINICA_MEDICA_SPECIALTIES,
  CLINICA_MEDICA_VIRTUAL_NAME,
} from "./examProfileToCurriculumBanca";
import { EXAM_PROFILES, calculateTopicDistribution } from "./realExamDistribution";

export interface ExamDistributionSubtopicNode {
  subtopicId: string | null;
  subtopicName: string;
  weight: number;
  estimatedQuestions: number;
}

export interface ExamDistributionTopicNode {
  topicId: string | null;
  topicName: string;
  weight: number;
  estimatedQuestions: number;
  subtopics: ExamDistributionSubtopicNode[];
}

export interface ExamDistributionSpecialtyNode {
  specialtyId: string | null;
  specialtyName: string;
  /** `true` se este nó é o agrupamento virtual de Clínica Médica. */
  isVirtualGroup?: boolean;
  weight: number;
  estimatedQuestions: number;
  topics: ExamDistributionTopicNode[];
}

export interface ExamDistributionTree {
  profileKey: string;
  totalQuestions: number;
  specialties: ExamDistributionSpecialtyNode[];
  source: "curriculum_weights" | "fallback_static";
  /** Telemetria leve para depuração. */
  debug: {
    bancaUsed: string | null;
    rawWeightsCount: number;
    specialtiesCount: number;
    topicsCount: number;
    subtopicsCount: number;
    roundingAdjustment: number;
  };
}

interface RawWeightRow {
  peso: number;
  subtopic_id: string;
  subtopic_name: string;
  topic_id: string;
  topic_name: string;
  specialty_id: string;
  specialty_name: string;
}

/** Mínimo de pesos para considerar uma banca como tendo cobertura suficiente. */
const MIN_WEIGHTS_FOR_DYNAMIC = 30;

/**
 * Distribui um total inteiro proporcionalmente aos pesos, devolvendo um
 * array de inteiros que soma exatamente `total`. Usa o método dos maiores
 * restos (Hamilton).
 */
function allocateIntegers(weights: number[], total: number): number[] {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / sumW) * total);
  const floors = exact.map((x) => Math.floor(x));
  const allocated = floors.reduce((s, x) => s + x, 0);
  let remainder = total - allocated;

  // Ordena índices pelos maiores restos fracionários
  const indices = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x), w: weights[i] }))
    .sort((a, b) => b.frac - a.frac || b.w - a.w)
    .map((x) => x.i);

  const result = [...floors];
  for (let k = 0; k < indices.length && remainder > 0; k++) {
    result[indices[k]] += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * Constrói a árvore de fallback estático (compatível com `EXAM_PROFILES`).
 * Mantém comportamento atual quando a banca não está no banco.
 */
function buildStaticFallback(
  profileKey: string,
  totalQuestions: number,
): ExamDistributionTree {
  const profile = EXAM_PROFILES[profileKey] ?? EXAM_PROFILES.GERAL;
  const dist = calculateTopicDistribution(profile, totalQuestions);

  const specialties: ExamDistributionSpecialtyNode[] = dist.map((item) => ({
    specialtyId: null,
    specialtyName: item.topic,
    weight: item.percent,
    estimatedQuestions: item.count,
    topics: (item.subtopics ?? []).map((s) => ({
      topicId: null,
      topicName: s.name,
      weight: s.percent,
      estimatedQuestions: s.count,
      subtopics: [],
    })),
  }));

  return {
    profileKey,
    totalQuestions,
    specialties,
    source: "fallback_static",
    debug: {
      bancaUsed: null,
      rawWeightsCount: 0,
      specialtiesCount: specialties.length,
      topicsCount: specialties.reduce((s, sp) => s + sp.topics.length, 0),
      subtopicsCount: 0,
      roundingAdjustment: 0,
    },
  };
}

/**
 * Função principal: monta a árvore dinâmica para um perfil + total de questões.
 * Sempre devolve uma estrutura válida (cai para fallback se necessário).
 */
export async function buildExamDistributionFromCurriculum(
  profileKey: string,
  totalQuestions: number,
): Promise<ExamDistributionTree> {
  const banca = profileToCurriculumBanca(profileKey);

  if (!banca) {
    console.info(
      `[ExamDistribution] Perfil "${profileKey}" sem mapeamento → fallback estático`,
    );
    return buildStaticFallback(profileKey, totalQuestions);
  }

  // Carrega pesos + hierarquia em uma única query
  const { data, error } = await supabase
    .from("curriculum_weights")
    .select(
      `
        peso,
        subtopic_id,
        curriculum_subtopics!inner (
          id,
          nome,
          ativo,
          curriculum_topics!inner (
            id,
            nome,
            ativo,
            curriculum_specialties!inner (
              id,
              nome,
              ativo
            )
          )
        )
      `,
    )
    .eq("banca", banca);

  if (error || !data || data.length < MIN_WEIGHTS_FOR_DYNAMIC) {
    console.warn(
      `[ExamDistribution] Banca "${banca}" sem dados suficientes (n=${data?.length ?? 0}) → fallback`,
      error,
    );
    return buildStaticFallback(profileKey, totalQuestions);
  }

  // Achata a estrutura aninhada e filtra inativos
  const rows: RawWeightRow[] = [];
  for (const row of data as any[]) {
    const sub = row.curriculum_subtopics;
    const top = sub?.curriculum_topics;
    const spec = top?.curriculum_specialties;
    if (!sub?.ativo || !top?.ativo || !spec?.ativo) continue;
    if (!Number.isFinite(row.peso) || row.peso <= 0) continue;

    rows.push({
      peso: row.peso,
      subtopic_id: sub.id,
      subtopic_name: sub.nome,
      topic_id: top.id,
      topic_name: top.nome,
      specialty_id: spec.id,
      specialty_name: spec.nome,
    });
  }

  if (rows.length < MIN_WEIGHTS_FOR_DYNAMIC) {
    return buildStaticFallback(profileKey, totalQuestions);
  }

  // ── Etapa 1: agrupa em árvore (specialty → topic → subtopic), somando pesos ──
  type SubAcc = { id: string; name: string; weight: number };
  type TopAcc = { id: string; name: string; weight: number; subs: Map<string, SubAcc> };
  type SpecAcc = {
    id: string | null;
    name: string;
    isVirtualGroup?: boolean;
    weight: number;
    tops: Map<string, TopAcc>;
  };

  const specMap = new Map<string, SpecAcc>();

  for (const r of rows) {
    // Agrupamento virtual de Clínica Médica
    const isClinica = CLINICA_MEDICA_SPECIALTIES.has(r.specialty_name);
    const specKey = isClinica ? `__virtual__${CLINICA_MEDICA_VIRTUAL_NAME}` : r.specialty_id;
    const specName = isClinica ? CLINICA_MEDICA_VIRTUAL_NAME : r.specialty_name;

    let spec = specMap.get(specKey);
    if (!spec) {
      spec = {
        id: isClinica ? null : r.specialty_id,
        name: specName,
        isVirtualGroup: isClinica || undefined,
        weight: 0,
        tops: new Map(),
      };
      specMap.set(specKey, spec);
    }
    spec.weight += r.peso;

    // Quando agrupado virtualmente, usamos o specialty real como "topic"
    // intermediário para preservar a granularidade (ex.: Clínica Médica >
    // Cardiologia > Síndrome Coronariana Aguda).
    const topKey = isClinica ? `${r.specialty_id}::${r.topic_id}` : r.topic_id;
    const topName = isClinica ? `${r.specialty_name} — ${r.topic_name}` : r.topic_name;

    let top = spec.tops.get(topKey);
    if (!top) {
      top = { id: r.topic_id, name: topName, weight: 0, subs: new Map() };
      spec.tops.set(topKey, top);
    }
    top.weight += r.peso;

    let sub = top.subs.get(r.subtopic_id);
    if (!sub) {
      sub = { id: r.subtopic_id, name: r.subtopic_name, weight: 0 };
      top.subs.set(r.subtopic_id, sub);
    }
    sub.weight += r.peso;
  }

  // ── Etapa 2: aloca quantidade de questões com método dos maiores restos ──
  const specArr = [...specMap.values()].sort((a, b) => b.weight - a.weight);
  const specWeights = specArr.map((s) => s.weight);
  const specCounts = allocateIntegers(specWeights, totalQuestions);
  const totalWeight = specWeights.reduce((s, w) => s + w, 0);

  const allocatedTotal = specCounts.reduce((s, n) => s + n, 0);
  const roundingAdjustment = totalQuestions - allocatedTotal;

  let totalTopics = 0;
  let totalSubtopics = 0;

  const specialties: ExamDistributionSpecialtyNode[] = specArr.map((spec, i) => {
    const specCount = specCounts[i];
    const tops = [...spec.tops.values()].sort((a, b) => b.weight - a.weight);
    const topWeights = tops.map((t) => t.weight);
    const topCounts = allocateIntegers(topWeights, specCount);

    const topics: ExamDistributionTopicNode[] = tops.map((top, ti) => {
      const topCount = topCounts[ti];
      const subs = [...top.subs.values()].sort((a, b) => b.weight - a.weight);
      const subWeights = subs.map((s) => s.weight);
      const subCounts = allocateIntegers(subWeights, topCount);

      const subtopics: ExamDistributionSubtopicNode[] = subs
        .map((s, si) => ({
          subtopicId: s.id,
          subtopicName: s.name,
          weight: top.weight > 0 ? Math.round((s.weight / top.weight) * 100) : 0,
          estimatedQuestions: subCounts[si],
        }))
        .filter((s) => s.estimatedQuestions > 0);

      totalSubtopics += subtopics.length;
      return {
        topicId: top.id,
        topicName: top.name,
        weight: spec.weight > 0 ? Math.round((top.weight / spec.weight) * 100) : 0,
        estimatedQuestions: topCount,
        subtopics,
      };
    }).filter((t) => t.estimatedQuestions > 0);

    totalTopics += topics.length;

    return {
      specialtyId: spec.id,
      specialtyName: spec.name,
      isVirtualGroup: spec.isVirtualGroup,
      weight: totalWeight > 0 ? Math.round((spec.weight / totalWeight) * 100) : 0,
      estimatedQuestions: specCount,
      topics,
    };
  }).filter((s) => s.estimatedQuestions > 0);

  console.info(
    `[ExamDistribution] Dinâmico OK: perfil=${profileKey} banca=${banca} specs=${specialties.length} topics=${totalTopics} subs=${totalSubtopics}`,
  );

  return {
    profileKey,
    totalQuestions,
    specialties,
    source: "curriculum_weights",
    debug: {
      bancaUsed: banca,
      rawWeightsCount: rows.length,
      specialtiesCount: specialties.length,
      topicsCount: totalTopics,
      subtopicsCount: totalSubtopics,
      roundingAdjustment,
    },
  };
}
