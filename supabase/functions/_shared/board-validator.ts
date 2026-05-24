
/**
 * Board Validator Module
 * Validates generated questions against the specific board's structural and semantic rules.
 */

import { BancaProfile } from "./banca-profiles.ts";

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0 to 1
  reason?: string;
  fixSuggestions?: string;
}

export function validateQuestionAgainstBoard(question: any, profile: BancaProfile): ValidationResult {
  let score = 1.0;
  const reasons: string[] = [];

  // 1. Structure Validation (Alternatives Count)
  const expectedCount = profile.optionsCount || (profile.mode === 'ce' ? 2 : 5);
  if (question.options?.length !== expectedCount) {
    score -= 0.4;
    reasons.push(`Contagem de alternativas incorreta: esperado ${expectedCount}, recebido ${question.options?.length}`);
  }

  // 2. Semantic Adherence (Cebraspe C/E)
  if (profile.mode === 'ce') {
    const isCE = question.options?.every((opt: string) => 
      ['certo', 'errado'].includes(opt.toLowerCase()) || 
      ['verdadeiro', 'falso'].includes(opt.toLowerCase())
    );
    if (!isCE) {
      score -= 0.5;
      reasons.push("Questão Certo/Errado com alternativas incorretas.");
    }
  }

  // 3. Statement Length / Quality
  if (question.statement?.length < 100 && profile.difficulty >= 4) {
    score -= 0.2;
    reasons.push("Enunciado muito curto para o nível de dificuldade da banca.");
  }

  // 4. Hallucination Check (Basic)
  const containsMarkdown = question.statement?.includes('```') || question.explanation?.includes('```');
  if (containsMarkdown) {
    score -= 0.1;
    reasons.push("Presença de artefatos de markdown no conteúdo.");
  }

  return {
    isValid: score >= 0.7,
    score,
    reason: reasons.join(" | "),
    fixSuggestions: score < 0.7 ? "Regenerar questão com foco total no estilo da banca e contagem de alternativas." : undefined
  };
}
