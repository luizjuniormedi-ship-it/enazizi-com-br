/**
 * Coverage Rules — regras centralizadas que classificam o status de
 * cobertura de cada subtopic/microtopic do acervo.
 *
 * Status:
 *  - complete  → ≥5 questões + incidência mapeada em ≥1 banca + (material OU flashcard)
 *  - partial   → tem questões (1–4) OU falta incidência OU falta material
 *  - critical  → marcado como muito_cobrado/cobrado e <2 questões
 *  - missing   → 0 questões + 0 incidência mapeada
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

  // missing — nada mapeado
  if (questionsCount === 0 && bancaCoverageCount === 0) {
    return {
      status: "missing",
      rule: "no-content-no-incidence",
      reason: "Nenhuma questão e nenhuma incidência mapeada por banca.",
    };
  }

  // critical — alta importância sem questões mínimas
  if (HIGH_IMPORTANCE.includes(importanceLevel) && questionsCount < 2) {
    return {
      status: "critical",
      rule: "high-importance-low-questions",
      reason: `Tópico classificado como ${importanceLevel} mas só ${questionsCount} questão(ões).`,
    };
  }

  // critical — 0 questões mas tem incidência (lacuna real)
  if (questionsCount === 0 && bancaCoverageCount > 0) {
    return {
      status: "critical",
      rule: "incidence-without-questions",
      reason: `Cobrado em ${bancaCoverageCount} banca(s) mas sem questões no acervo.`,
    };
  }

  // complete — 5+ questões, incidência e material/flashcard
  if (
    questionsCount >= 5 &&
    bancaCoverageCount >= 1 &&
    (materialsCount > 0 || flashcardsCount > 0)
  ) {
    return {
      status: "complete",
      rule: "fully-covered",
      reason: `${questionsCount} questões, ${bancaCoverageCount} banca(s) e material de estudo.`,
    };
  }

  // partial — qualquer outro caso intermediário
  const gaps: string[] = [];
  if (questionsCount < 5) gaps.push(`apenas ${questionsCount} questão(ões)`);
  if (bancaCoverageCount === 0) gaps.push("sem incidência por banca");
  if (materialsCount === 0 && flashcardsCount === 0) gaps.push("sem material/flashcard");
  return {
    status: "partial",
    rule: "partial-coverage",
    reason: gaps.join(", ") || "Cobertura intermediária.",
  };
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
