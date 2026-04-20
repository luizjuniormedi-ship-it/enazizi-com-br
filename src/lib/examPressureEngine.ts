/**
 * examPressureEngine — Pressão temporal da prova
 * ───────────────────────────────────────────────
 * Função pura que retorna um multiplicador de prioridade
 * baseado na proximidade da data da prova.
 */

export type PressureLevel = "none" | "low" | "medium" | "high";

export interface ExamPressure {
  days: number | null;
  pressure_level: PressureLevel;
  multiplier: number;
}

export function getExamPressure(examDate?: string | Date | null): ExamPressure {
  if (!examDate) {
    return { days: null, pressure_level: "none", multiplier: 1.0 };
  }
  const d = examDate instanceof Date ? examDate : new Date(examDate);
  if (isNaN(d.getTime())) {
    return { days: null, pressure_level: "none", multiplier: 1.0 };
  }

  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);

  // Prova já passou → sem pressão
  if (days < 0) {
    return { days, pressure_level: "none", multiplier: 1.0 };
  }
  if (days < 30) {
    return { days, pressure_level: "high", multiplier: 1.6 };
  }
  if (days <= 90) {
    return { days, pressure_level: "medium", multiplier: 1.3 };
  }
  return { days, pressure_level: "low", multiplier: 1.0 };
}
