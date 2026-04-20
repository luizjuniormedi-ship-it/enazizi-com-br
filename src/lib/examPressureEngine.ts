/**
 * examPressureEngine — Pressão temporal da prova
 * ───────────────────────────────────────────────
 * Função pura que retorna um multiplicador de prioridade
 * baseado na proximidade da data da prova.
 *
 * Pesos vêm de `studyEngineCalibration.ts` (centralizado).
 */
import { STUDY_ENGINE_CALIBRATION } from "./studyEngineCalibration";

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
  const cal = STUDY_ENGINE_CALIBRATION;

  // Prova já passou → sem pressão
  if (days < 0) {
    return { days, pressure_level: "none", multiplier: 1.0 };
  }
  if (days < cal.thresholds.finalStretchDays) {
    return { days, pressure_level: "high", multiplier: cal.examPressure.finalStretchMultiplier };
  }
  if (days <= 90) {
    return { days, pressure_level: "medium", multiplier: cal.examPressure.midTermMultiplier };
  }
  return { days, pressure_level: "low", multiplier: 1.0 };
}
