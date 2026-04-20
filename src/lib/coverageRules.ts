/**
 * Coverage Rules — regras centralizadas que classificam o status de
 * cobertura de cada subtopic/microtopic do acervo.
 *
 * Status:
 *  - complete  → ≥5 questões + incidência mapeada em ≥1 banca + (material OU flashcard)
 *  - partial   → tem questões (1–4) OU falta incidência OU falta material
 *  - critical  → marcado como muito_cobrado/cobrado e <2 questões; OU incidência sem questão
 *  - missing   → 0 questões + 0 incidência mapeada + 0 material + 0 flashcard
 *
 * Fase 1.2: passa a considerar `materialsCount` e `flashcardsCount` reais
 * vindos de `study_materials` e `flashcards` (com vínculo curricular).
 *
 * Usado pelo painel admin de Cobertura Completa e (futuramente) pelo
 * Study Engine para priorizar lacunas.
 */

export type CoverageStatus = "complete" | "partial" | "critical" | "missing";
export type ImportanceLevel = "muito_cobrado" | "cobrado" | "pouco_cobrado" | "raro" | null;

export interface CoverageInputs {
  questionsCount: number;
  bancaCoverageCount: number; // quantas bancas têm peso/incidência mapeada
  materialsCount: number;
  flashcardsCount: number;
  importanceLevel: ImportanceLevel;
}

export interface CoverageVerdict {
  status: CoverageStatus;
  rule: string;
  reason: string;
}

const HIGH_IMPORTANCE: ImportanceLevel[] = ["muito_cobrado", "cobrado"];

export function classifyCoverage(input: CoverageInputs): CoverageVerdict {
  const { questionsCount, bancaCoverageCount, materialsCount, flashcardsCount, importanceLevel } = input;
  const hasPedagogy = materialsCount > 0 || flashcardsCount > 0;

  // missing — nada mapeado em nenhuma dimensão
  if (questionsCount === 0 && bancaCoverageCount === 0 && !hasPedagogy) {
    return {
      status: "missing",
      rule: "no-content-anywhere",
      reason: "Sem questões, incidência ou material/flashcard.",
    };
  }

  // critical — alta importância sem questões mínimas
  if (HIGH_IMPORTANCE.includes(importanceLevel) && questionsCount < 2) {
    return {
      status: "critical",
      rule: "high-importance-low-questions",
      reason: `Tópico ${importanceLevel} mas só ${questionsCount} questão(ões) ${
        hasPedagogy ? "(há material, mas sem prova)" : "e sem material"
      }.`,
    };
  }

  // critical — alta importância sem material pedagógico (gap pedagógico crítico)
  if (HIGH_IMPORTANCE.includes(importanceLevel) && !hasPedagogy) {
    return {
      status: "critical",
      rule: "high-importance-no-pedagogy",
      reason: `Tópico ${importanceLevel} sem material nem flashcard (apenas ${questionsCount} questão(ões)).`,
    };
  }

  // critical — 0 questões mas tem incidência (lacuna real de prova)
  if (questionsCount === 0 && bancaCoverageCount > 0) {
    return {
      status: "critical",
      rule: "incidence-without-questions",
      reason: `Cobrado em ${bancaCoverageCount} banca(s) mas sem questões no acervo.`,
    };
  }

  // complete — ≥5 questões + incidência + material/flashcard
  if (questionsCount >= 5 && bancaCoverageCount >= 1 && hasPedagogy) {
    return {
      status: "complete",
      rule: "fully-covered",
      reason: `${questionsCount} questões, ${bancaCoverageCount} banca(s), ${materialsCount} material(is) e ${flashcardsCount} flashcard(s).`,
    };
  }

  // partial — qualquer outro caso intermediário
  const gaps: string[] = [];
  if (questionsCount < 5) gaps.push(`apenas ${questionsCount} questão(ões)`);
  if (bancaCoverageCount === 0) gaps.push("sem incidência por banca");
  if (materialsCount === 0) gaps.push("sem material");
  if (flashcardsCount === 0) gaps.push("sem flashcard");
  return {
    status: "partial",
    rule: "partial-coverage",
    reason: gaps.join(", ") || "Cobertura intermediária.",
  };
}

/**
 * coverage_score (0–100) — indicador pedagógico para o painel admin.
 * Não é usado pelo motor (Study Engine) nesta fase. Pondera:
 *  - 40% questões (alvo: 5)
 *  - 30% material (alvo: 2)
 *  - 30% flashcards (alvo: 5)
 */
export function computeCoverageScore(input: Pick<CoverageInputs, "questionsCount" | "materialsCount" | "flashcardsCount">): number {
  const qScore = Math.min(input.questionsCount / 5, 1) * 40;
  const mScore = Math.min(input.materialsCount / 2, 1) * 30;
  const fScore = Math.min(input.flashcardsCount / 5, 1) * 30;
  return Math.round(qScore + mScore + fScore);
}

/** Cor semântica usada no painel (mapeia para classes Tailwind). */
export function statusBadgeVariant(status: CoverageStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "complete": return "default";
    case "partial": return "secondary";
    case "critical": return "destructive";
    case "missing": return "outline";
  }
}

export function statusLabel(status: CoverageStatus): string {
  return { complete: "Completo", partial: "Parcial", critical: "Crítico", missing: "Ausente" }[status];
}
