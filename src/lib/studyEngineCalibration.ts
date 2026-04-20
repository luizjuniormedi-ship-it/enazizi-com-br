/**
 * studyEngineCalibration — Camada central de pesos do motor adaptativo
 * ─────────────────────────────────────────────────────────────────────
 * Centraliza TODOS os números mágicos usados pelos engines:
 *   - studyEngine.ts (boosts V3 + V3.1)
 *   - examPressureEngine.ts (multiplicadores)
 *   - questionDistributionEngine.ts (thresholds)
 *
 * Suporta 3 modos: conservative | balanced | aggressive.
 * Trocar de modo = trocar a constante CALIBRATION_MODE abaixo.
 *
 * NÃO altera schema, NÃO cria UI de edição. Apenas leitura/snapshot.
 */

export type CalibrationMode = "conservative" | "balanced" | "aggressive";

export interface StudyEngineCalibration {
  /** Boost flat aplicado a recs que casam com gaps obrigatórios (coverage). */
  coverageGapBoost: number;
  /** Boost quando paceStatus do monthlyGoal === "behind". */
  monthlyGoalBoost: number;
  /** Boost extra quando backlog rolante 30d > heavyBacklog. */
  monthlyGoalHeavyBacklogBoost: number;
  /** Boost flat V3 quando questionGoal.status === "behind" e rec é de questão. */
  questionGoalBehindBoost: number;

  examPressure: {
    /** Multiplicador para 30 ≤ days ≤ 90 (médio prazo). */
    midTermMultiplier: number;
    /** Multiplicador para days < 30 (reta final). */
    finalStretchMultiplier: number;
    /** Penalidade aplicada a conteúdo novo quando days < finalStretchDays. */
    newContentPenaltyUnder30Days: number;
  };

  questionDistribution: {
    /** Divisor que escala % da distribuição em pontos de prioridade. */
    boostScaleDivisor: number;
    /** Ajuste de coverage quando coveragePct < lowCoveragePct. */
    lowCoverageAdjustment: number;
    /** Ajuste de error quando errorCount > highErrorCount. */
    highErrorAdjustment: number;
    /** Ajuste de incidence quando aluno está atrasado. */
    behindGoalAdjustment: number;
  };

  thresholds: {
    /** Cobertura considerada baixa (gera ajuste +coverage). */
    lowCoveragePct: number;
    /** Quantidade de erros considerada alta (gera ajuste +error). */
    highErrorCount: number;
    /** Backlog rolante 30d considerado pesado. */
    heavyBacklog: number;
    /** Janela de reta final em dias. */
    finalStretchDays: number;
    /** Janela de médio prazo em dias. */
    midTermDays: number;
  };
}

const BALANCED: StudyEngineCalibration = {
  coverageGapBoost: 12,
  monthlyGoalBoost: 8,
  monthlyGoalHeavyBacklogBoost: 10,
  questionGoalBehindBoost: 20,
  examPressure: {
    midTermMultiplier: 1.3,
    finalStretchMultiplier: 1.6,
    newContentPenaltyUnder30Days: 15,
  },
  questionDistribution: {
    boostScaleDivisor: 4,
    lowCoverageAdjustment: 10,
    highErrorAdjustment: 10,
    behindGoalAdjustment: 10,
  },
  thresholds: {
    lowCoveragePct: 50,
    highErrorCount: 50,
    heavyBacklog: 500,
    finalStretchDays: 30,
    midTermDays: 60,
  },
};

const CONSERVATIVE: StudyEngineCalibration = {
  ...BALANCED,
  coverageGapBoost: 8,
  monthlyGoalBoost: 5,
  monthlyGoalHeavyBacklogBoost: 6,
  questionGoalBehindBoost: 12,
  examPressure: {
    midTermMultiplier: 1.15,
    finalStretchMultiplier: 1.35,
    newContentPenaltyUnder30Days: 10,
  },
  questionDistribution: {
    ...BALANCED.questionDistribution,
    boostScaleDivisor: 6,
    lowCoverageAdjustment: 6,
    highErrorAdjustment: 6,
    behindGoalAdjustment: 6,
  },
};

const AGGRESSIVE: StudyEngineCalibration = {
  ...BALANCED,
  coverageGapBoost: 18,
  monthlyGoalBoost: 12,
  monthlyGoalHeavyBacklogBoost: 15,
  questionGoalBehindBoost: 28,
  examPressure: {
    midTermMultiplier: 1.45,
    finalStretchMultiplier: 1.85,
    newContentPenaltyUnder30Days: 22,
  },
  questionDistribution: {
    ...BALANCED.questionDistribution,
    boostScaleDivisor: 3,
    lowCoverageAdjustment: 14,
    highErrorAdjustment: 14,
    behindGoalAdjustment: 14,
  },
};

const PRESETS: Record<CalibrationMode, StudyEngineCalibration> = {
  conservative: CONSERVATIVE,
  balanced: BALANCED,
  aggressive: AGGRESSIVE,
};

/** Modo ativo. Trocar aqui para recalibrar globalmente. */
export const STUDY_ENGINE_CALIBRATION_MODE: CalibrationMode = "balanced";

/** Versão semântica — incrementar quando alterar pesos para auditoria. */
export const STUDY_ENGINE_CALIBRATION_VERSION = "v1.0.0";

/** Pesos efetivos do motor (resultado do modo ativo). */
export const STUDY_ENGINE_CALIBRATION: StudyEngineCalibration =
  PRESETS[STUDY_ENGINE_CALIBRATION_MODE];

/** Snapshot serializável para gravar em assistant_decisions. */
export function getCalibrationSnapshot() {
  return {
    calibration_version: STUDY_ENGINE_CALIBRATION_VERSION,
    calibration_mode: STUDY_ENGINE_CALIBRATION_MODE,
    calibration: {
      coverageGapBoost: STUDY_ENGINE_CALIBRATION.coverageGapBoost,
      monthlyGoalBoost: STUDY_ENGINE_CALIBRATION.monthlyGoalBoost,
      monthlyGoalHeavyBacklogBoost: STUDY_ENGINE_CALIBRATION.monthlyGoalHeavyBacklogBoost,
      questionGoalBehindBoost: STUDY_ENGINE_CALIBRATION.questionGoalBehindBoost,
      examPressure: { ...STUDY_ENGINE_CALIBRATION.examPressure },
      questionDistribution: { ...STUDY_ENGINE_CALIBRATION.questionDistribution },
      thresholds: { ...STUDY_ENGINE_CALIBRATION.thresholds },
    },
  };
}

/** Rótulo legível p/ UI. */
export function getCalibrationLabel(mode: CalibrationMode = STUDY_ENGINE_CALIBRATION_MODE): string {
  if (mode === "conservative") return "calibração conservadora";
  if (mode === "aggressive") return "calibração agressiva";
  return "calibração equilibrada";
}
