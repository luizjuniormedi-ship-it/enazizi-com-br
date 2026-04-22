import { useMemo } from "react";
import { useCurriculumTree } from "@/hooks/useProfessorPlans";

/**
 * Matcher fuzzy de subtemas digitados/upload contra o currículo real.
 * Não cria registros — apenas resolve nomes livres em `curriculum_subtopics.id`
 * existentes, para que `professor_plan_subtopics.subtopic_id` (FK obrigatória)
 * possa ser populado com confiança.
 *
 * Estratégia:
 *  1) Normaliza (lowercase, sem acentos, sem pontuação)
 *  2) Match exato → score 1.0
 *  3) Match por contém / contém-em → 0.85
 *  4) Similaridade por tokens compartilhados (Jaccard) → 0..0.8
 *  5) Quando há linha estruturada (especialidade,tema,subtema), boost de +0.1
 *     se a especialidade/tema também batem.
 */

export interface CandidateSubtopic {
  id: string;
  nome: string;
  topicNome: string;
  specialtyNome: string;
}

export interface ResolvedRow {
  raw: string;
  hint?: { specialty?: string; topic?: string };
  best?: { candidate: CandidateSubtopic; score: number };
  alternatives: { candidate: CandidateSubtopic; score: number }[];
  status: "high" | "medium" | "low" | "none";
}

const HIGH = 0.85;
const MEDIUM = 0.55;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function score(rawNorm: string, candidate: CandidateSubtopic): number {
  const candNorm = normalize(candidate.nome);
  if (rawNorm === candNorm) return 1;
  if (candNorm.includes(rawNorm) || rawNorm.includes(candNorm)) return 0.88;
  const j = jaccard(tokenize(rawNorm), tokenize(candNorm));
  // pequeno bônus se compartilham primeira palavra
  const firstA = rawNorm.split(" ")[0];
  const firstB = candNorm.split(" ")[0];
  const bonus = firstA && firstA === firstB ? 0.05 : 0;
  return Math.min(0.84, j * 0.8 + bonus);
}

export interface RawInputRow {
  raw: string;
  specialtyHint?: string;
  topicHint?: string;
}

export function useSubtopicMatcher() {
  const { data: tree } = useCurriculumTree();

  const flat: CandidateSubtopic[] = useMemo(() => {
    const out: CandidateSubtopic[] = [];
    (tree || []).forEach((spec: any) => {
      (spec.curriculum_topics || []).forEach((t: any) => {
        (t.curriculum_subtopics || [])
          .filter((s: any) => s.ativo)
          .forEach((s: any) => {
            out.push({
              id: s.id,
              nome: s.nome,
              topicNome: t.nome,
              specialtyNome: spec.nome,
            });
          });
      });
    });
    return out;
  }, [tree]);

  function resolve(rows: RawInputRow[]): ResolvedRow[] {
    return rows
      .map((row) => {
        const raw = row.raw.trim();
        if (!raw) return null;
        const rawNorm = normalize(raw);
        const specHint = row.specialtyHint ? normalize(row.specialtyHint) : null;
        const topicHint = row.topicHint ? normalize(row.topicHint) : null;

        const scored = flat
          .map((c) => {
            let s = score(rawNorm, c);
            if (specHint && normalize(c.specialtyNome).includes(specHint)) s += 0.07;
            if (topicHint && normalize(c.topicNome).includes(topicHint)) s += 0.05;
            return { candidate: c, score: Math.min(1, s) };
          })
          .filter((m) => m.score > 0.2)
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        const alternatives = scored.slice(1, 4);
        const status: ResolvedRow["status"] = !best
          ? "none"
          : best.score >= HIGH
          ? "high"
          : best.score >= MEDIUM
          ? "medium"
          : "low";
        return {
          raw,
          hint: row.specialtyHint || row.topicHint
            ? { specialty: row.specialtyHint, topic: row.topicHint }
            : undefined,
          best,
          alternatives,
          status,
        };
      })
      .filter(Boolean) as ResolvedRow[];
  }

  return { resolve, hasCurriculum: flat.length > 0, totalCandidates: flat.length };
}

/**
 * Faz parse de TXT (1 subtema por linha) ou CSV.
 * - CSV simples (1 coluna): cada linha é 1 subtema.
 * - CSV estruturado: cabeçalho com `especialidade,tema,subtema` (qualquer ordem).
 */
export function parseSubtopicsFile(text: string): RawInputRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // detecta cabeçalho
  const first = lines[0].toLowerCase();
  const hasHeader =
    /(especialidade|tema|subtema|specialty|topic|subtopic)/.test(first);

  if (hasHeader) {
    const header = splitCsvLine(lines[0]).map((h) => normalize(h));
    const idxSpec = header.findIndex((h) => /especialidade|specialty/.test(h));
    const idxTop = header.findIndex((h) => /^tema$|topic$|^topico$/.test(h));
    const idxSub = header.findIndex((h) => /subtema|subtopic/.test(h));
    return lines.slice(1).map((line) => {
      const cols = splitCsvLine(line);
      const sub = idxSub >= 0 ? cols[idxSub] : cols[cols.length - 1];
      return {
        raw: (sub || "").trim(),
        specialtyHint: idxSpec >= 0 ? cols[idxSpec]?.trim() : undefined,
        topicHint: idxTop >= 0 ? cols[idxTop]?.trim() : undefined,
      };
    });
  }

  // sem cabeçalho: pode ser CSV de 1 coluna ou TXT linha-a-linha.
  // Se a maioria das linhas tem ',' assumimos CSV simples e pegamos a última coluna.
  const isCsvLike = lines.filter((l) => l.includes(",")).length > lines.length / 2;
  return lines.map((l) => ({
    raw: isCsvLike ? splitCsvLine(l).slice(-1)[0]?.trim() || "" : l,
  }));
}

function splitCsvLine(line: string): string[] {
  // Parser simples (sem aspas escapadas internas; suficiente para nossa entrada)
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
