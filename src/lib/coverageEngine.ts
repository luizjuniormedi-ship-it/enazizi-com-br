/**
 * Coverage Engine
 * ───────────────
 * Garantia de cobertura curricular + sinal adaptativo contínuo.
 *
 * Reusa fontes vivas existentes (sem novas tabelas):
 *   - `curriculum_matrix`        → mapa do que pode cair (weight, incidence, prioridade)
 *   - `temas_estudados`          → temas já vistos pelo aluno
 *   - `desempenho_questoes`      → mastery (taxa_acerto) por tema
 *   - `error_bank`               → erros e taxa de erro derivada
 *
 * Saída:
 *   - cobertura % global
 *   - cobertura % por especialidade
 *   - lista de temas críticos NÃO vistos (alta incidência ou prioridade alta)
 *   - próximo tema obrigatório (top required ainda não estudado)
 *
 * Sem schema novo. Sem RLS novo. Sem edge function nova.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoverageTopic {
  id: string;
  especialidade: string;
  tema: string;
  subtema: string;
  prioridade: number;       // 0-10 (curriculum_matrix.prioridade_base)
  incidencia: string;       // 'altissima' | 'alta' | 'media' | 'baixa'
  isRequired: boolean;      // derivado: prioridade ≥ 7 ou incidencia ∈ {altissima, alta}
  seen: boolean;
  mastery: number;          // 0-100 (taxa de acerto média do tema)
  errorRate: number;        // 0-100 (vezes_errado / total)
  lastSeen: string | null;  // ISO
}

export interface SpecialtyCoverage {
  especialidade: string;
  total: number;
  seen: number;
  required: number;
  requiredSeen: number;
  coveragePct: number;          // seen/total
  requiredCoveragePct: number;  // requiredSeen/required
}

export interface CoverageStatus {
  /** % de todos os subtemas vistos */
  globalCoveragePct: number;
  /** % dos subtemas obrigatórios vistos (sinal mais importante) */
  requiredCoveragePct: number;
  totalTopics: number;
  seenTopics: number;
  requiredTopics: number;
  requiredSeen: number;
  /** Temas obrigatórios ainda NÃO vistos, ordenados por prioridade desc */
  criticalGaps: CoverageTopic[];
  /** Próximo tema obrigatório recomendado (top critical gap) */
  nextRequiredTopic: CoverageTopic | null;
  /** Cobertura por especialidade (ordem: pior cobertura primeiro) */
  bySpecialty: SpecialtyCoverage[];
  generatedAt: string;
}

/** Heurística de obrigatoriedade derivada da matriz curricular. */
function isRequired(prioridade: number, incidencia: string): boolean {
  if (prioridade >= 7) return true;
  const inc = (incidencia || "").toLowerCase();
  return inc === "altissima" || inc === "alta";
}

/** Match flexível entre nome de tema do estudo e subtema/tema curricular. */
function topicMatches(studied: string, candidate: string): boolean {
  if (!studied || !candidate) return false;
  const a = studied.toLowerCase().trim();
  const b = candidate.toLowerCase().trim();
  if (a === b) return true;
  if (a.length >= 6 && b.includes(a)) return true;
  if (b.length >= 6 && a.includes(b)) return true;
  // janela de 10 chars (mesma heurística usada em CurriculumCoverageCard)
  return a.slice(0, 10) === b.slice(0, 10) && a.length >= 10 && b.length >= 10;
}

/**
 * Calcula a cobertura curricular do aluno.
 * Tudo é defensivo: qualquer falha de consulta cai em estado vazio sem quebrar.
 */
export async function getCoverageStatus(userId: string): Promise<CoverageStatus> {
  const empty: CoverageStatus = {
    globalCoveragePct: 0,
    requiredCoveragePct: 0,
    totalTopics: 0,
    seenTopics: 0,
    requiredTopics: 0,
    requiredSeen: 0,
    criticalGaps: [],
    nextRequiredTopic: null,
    bySpecialty: [],
    generatedAt: new Date().toISOString(),
  };
  if (!userId) return empty;

  // 1) Mapa curricular ativo (fonte: curriculum_matrix)
  const { data: matrix, error: matrixErr } = await supabase
    .from("curriculum_matrix")
    .select("id, especialidade, tema, subtema, prioridade_base, incidencia_geral")
    .eq("ativo", true)
    .limit(1000);
  if (matrixErr || !matrix || matrix.length === 0) {
    console.warn("[coverageEngine] curriculum_matrix vazio/erro:", matrixErr?.message);
    return empty;
  }

  // 2) Temas já estudados (fonte: temas_estudados)
  const { data: temas } = await supabase
    .from("temas_estudados")
    .select("tema, updated_at, created_at")
    .eq("user_id", userId)
    .limit(2000);
  const studiedList = (temas ?? []).map((t: any) => ({
    tema: String(t.tema || "").toLowerCase(),
    when: t.updated_at || t.created_at || null,
  }));

  // 3) Mastery por tema (fonte: desempenho_questoes — média de taxa_acerto)
  const { data: perf } = await supabase
    .from("desempenho_questoes")
    .select("tema_id, taxa_acerto, questoes_feitas, data_registro")
    .eq("user_id", userId)
    .limit(2000);
  // tema_id em desempenho_questoes referencia temas_estudados.id, não o nome.
  // Para evitar JOIN custoso, usamos como sinal agregado por tema NOME via temas_estudados.
  // Estratégia: buscar mapeamento id → tema (nome) em uma query barata.
  let temaIdToName: Record<string, string> = {};
  if (perf && perf.length > 0) {
    const ids = [...new Set(perf.map((p: any) => p.tema_id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: temasFull } = await supabase
        .from("temas_estudados")
        .select("id, tema")
        .in("id", ids);
      for (const t of (temasFull ?? []) as any[]) {
        temaIdToName[t.id] = String(t.tema || "").toLowerCase();
      }
    }
  }
  const masteryByTopic: Record<string, { sum: number; n: number }> = {};
  for (const p of (perf ?? []) as any[]) {
    const name = temaIdToName[p.tema_id];
    if (!name) continue;
    const v = Number(p.taxa_acerto ?? 0);
    if (!Number.isFinite(v)) continue;
    if (!masteryByTopic[name]) masteryByTopic[name] = { sum: 0, n: 0 };
    masteryByTopic[name].sum += v;
    masteryByTopic[name].n += 1;
  }

  // 4) Error bank (fonte: error_bank) — taxa de erro relativa
  const { data: errors } = await supabase
    .from("error_bank")
    .select("tema, vezes_errado")
    .eq("user_id", userId)
    .limit(2000);
  const errorByTopic: Record<string, number> = {};
  for (const e of (errors ?? []) as any[]) {
    const name = String(e.tema || "").toLowerCase();
    if (!name) continue;
    errorByTopic[name] = (errorByTopic[name] || 0) + Number(e.vezes_errado || 1);
  }

  // 5) Cruzamento curriculum × progresso
  const topics: CoverageTopic[] = (matrix as any[]).map((m) => {
    const subtemaLower = String(m.subtema || "").toLowerCase();
    const temaLower = String(m.tema || "").toLowerCase();

    const seenEntry = studiedList.find(
      (s) => topicMatches(s.tema, subtemaLower) || topicMatches(s.tema, temaLower)
    );
    const seen = !!seenEntry;

    // mastery: tenta subtema, cai no tema
    const masterySrc = masteryByTopic[subtemaLower] || masteryByTopic[temaLower];
    const mastery = masterySrc && masterySrc.n > 0
      ? Math.round(masterySrc.sum / masterySrc.n)
      : 0;

    const errs = errorByTopic[subtemaLower] || errorByTopic[temaLower] || 0;
    // taxa de erro normalizada: capada em 100 (cada erro = ~10 pts até saturar)
    const errorRate = Math.min(100, errs * 10);

    const prioridade = Number(m.prioridade_base ?? 5);
    const incidencia = String(m.incidencia_geral || "media");

    return {
      id: String(m.id),
      especialidade: String(m.especialidade || "Geral"),
      tema: String(m.tema || ""),
      subtema: String(m.subtema || ""),
      prioridade,
      incidencia,
      isRequired: isRequired(prioridade, incidencia),
      seen,
      mastery,
      errorRate,
      lastSeen: seenEntry?.when ?? null,
    };
  });

  // 6) Agregações
  const totalTopics = topics.length;
  const seenTopics = topics.filter((t) => t.seen).length;
  const requiredArr = topics.filter((t) => t.isRequired);
  const requiredTopics = requiredArr.length;
  const requiredSeen = requiredArr.filter((t) => t.seen).length;

  const criticalGaps = requiredArr
    .filter((t) => !t.seen)
    .sort((a, b) => b.prioridade - a.prioridade)
    .slice(0, 50);

  const nextRequiredTopic = criticalGaps[0] ?? null;

  // Por especialidade
  const specMap = new Map<string, SpecialtyCoverage>();
  for (const t of topics) {
    const k = t.especialidade;
    const cur = specMap.get(k) ?? {
      especialidade: k,
      total: 0,
      seen: 0,
      required: 0,
      requiredSeen: 0,
      coveragePct: 0,
      requiredCoveragePct: 0,
    };
    cur.total += 1;
    if (t.seen) cur.seen += 1;
    if (t.isRequired) {
      cur.required += 1;
      if (t.seen) cur.requiredSeen += 1;
    }
    specMap.set(k, cur);
  }
  const bySpecialty = Array.from(specMap.values()).map((s) => ({
    ...s,
    coveragePct: s.total > 0 ? Math.round((s.seen / s.total) * 100) : 0,
    requiredCoveragePct: s.required > 0 ? Math.round((s.requiredSeen / s.required) * 100) : 0,
  })).sort((a, b) => a.requiredCoveragePct - b.requiredCoveragePct);

  return {
    globalCoveragePct: totalTopics > 0 ? Math.round((seenTopics / totalTopics) * 100) : 0,
    requiredCoveragePct: requiredTopics > 0 ? Math.round((requiredSeen / requiredTopics) * 100) : 0,
    totalTopics,
    seenTopics,
    requiredTopics,
    requiredSeen,
    criticalGaps,
    nextRequiredTopic,
    bySpecialty,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Devolve apenas os "top N gaps" obrigatórios (uso pelo Study Engine para boost).
 * Não dispara queries adicionais — espera receber CoverageStatus já calculado.
 */
export function getTopCriticalGaps(status: CoverageStatus, n = 10): CoverageTopic[] {
  return status.criticalGaps.slice(0, n);
}
