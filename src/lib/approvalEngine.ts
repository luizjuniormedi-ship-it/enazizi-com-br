/**
 * Approval Engine — Re-export estável
 * ────────────────────────────────────
 * A lógica vive em `src/engines/approvalEngine.ts` (engine puro, testável).
 * Este módulo expõe a API pública estável conforme contrato do produto:
 *   - ApprovalInput / ApprovalOutput
 *   - calculateApprovalScore(input): ApprovalOutput   (com trend embutido)
 *
 * Mantém compatibilidade com consumidores antigos via re-export.
 */
import {
  calculateApprovalScore as _calc,
  calculateTrend,
  approvalToneClass,
  approvalBadgeBg,
  type ApprovalRisk,
  type ApprovalTrend,
} from "@/engines/approvalEngine";

export interface ApprovalInput {
  accuracy: number;          // 0..100
  coverage: number;          // 0..100
  consistency: number;       // 0..100
  fsrsHealth: number;        // 0..100
  questionsVolume: number;   // questões em 30 dias
  questions7d: number;       // questões em 7 dias
  fsrsDue: number;           // total de revisões atrasadas
  daysToExam: number | null; // dias até a prova
  previousScore?: number | null;
}

export interface ApprovalOutput {
  score: number;
  trend: ApprovalTrend;
  riskLevel: ApprovalRisk;
  message: string;
  components: {
    accuracy: number;
    coverage: number;
    consistency: number;
    fsrsHealth: number;
    volumeNormalized: number;
  };
}

/**
 * Calcula score + trend em uma única chamada.
 * Trend usa `previousScore` (opcional) — se ausente, retorna "stable".
 */
export function calculateApprovalScore(input: ApprovalInput): ApprovalOutput {
  const r = _calc({
    accuracy: input.accuracy,
    coverage: input.coverage,
    consistency: input.consistency,
    fsrsHealth: input.fsrsHealth,
    questionsVolume: input.questionsVolume,
    questions7d: input.questions7d,
    fsrsDue: input.fsrsDue,
    daysToExam: input.daysToExam,
  });

  const trend = calculateTrend(r.score, input.previousScore ?? null);

  return {
    score: r.score,
    trend,
    riskLevel: r.riskLevel,
    message: r.message,
    components: {
      accuracy: r.breakdown.accuracy,
      coverage: r.breakdown.coverage,
      consistency: r.breakdown.consistency,
      fsrsHealth: r.breakdown.fsrsHealth,
      volumeNormalized: r.breakdown.volume,
    },
  };
}

export { calculateTrend, approvalToneClass, approvalBadgeBg };
export type { ApprovalRisk, ApprovalTrend };
