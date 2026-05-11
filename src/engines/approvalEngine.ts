/**
 * Approval Prediction Engine
 * ──────────────────────────
 * Calcula a chance de aprovação do aluno em tempo real, combinando
 * sinais já existentes na plataforma (acurácia, cobertura, frequência,
 * saúde do FSRS, volume de questões, proximidade da prova).
 *
 * Pure / sem side-effects → fácil de testar e usar client-side.
 */

export type ApprovalRisk = "low" | "medium" | "high";
export type ApprovalTrend = "up" | "down" | "stable";

export interface ApprovalEngineInput {
  /** % de acertos no período (0–100) */
  accuracy: number;
  /** % de cobertura curricular obrigatória (0–100) */
  coverage: number;
  /** Consistência: dias estudados nos últimos 7 (0–7 → normalizado 0–100) */
  consistency: number;
  /** Saúde do FSRS: revisões em dia vs atrasadas (0–100) */
  fsrsHealth: number;
  /** Volume de questões últimos 30d (bruto) */
  questionsVolume: number;
  /** Volume últimos 7d (para penalização de inatividade) */
  questions7d?: number;
  /** Revisões pendentes/atrasadas (count absoluto) */
  fsrsDue?: number;
  /** Dias até a prova (null se desconhecido) */
  daysToExam: number | null;
  /** NOVO V2: Fator de Dificuldade/TRI (0.5 a 1.5, default 1.0) */
  difficultyFactor?: number;
  /** NOVO V2: Fator de Retenção (derivado de FSRS stability) */
  retentionFactor?: number;
}

export interface ApprovalEngineResult {
  score: number;               // 0–100
  trend: ApprovalTrend;
  riskLevel: ApprovalRisk;
  message: string;
  /** Componentes do score (debug/transparência) */
  breakdown: {
    accuracy: number;
    coverage: number;
    consistency: number;
    fsrsHealth: number;
    volume: number;
    penalties: number;
  };
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/**
 * Normaliza volume 30d para 0–100.
 * Referência: 300 questões/30d ≈ excelente (100).
 */
function normalizeVolume(v: number): number {
  if (v <= 0) return 0;
  return clamp((v / 300) * 100);
}

/**
 * Calcula score de aprovação (0–100) e classificação de risco.
 * Fórmula:
 *   score = accuracy*0.35 + coverage*0.25 + consistency*0.15
 *         + fsrsHealth*0.10 + volumeNormalized*0.15
 * Penalidades:
 *   - questions7d === 0       → score *= 0.6
 *   - fsrsDue > 100           → -10
 *   - daysToExam < 30 + low V → -15
 */
export function calculateApprovalScore(input: ApprovalEngineInput): ApprovalEngineResult {
  const accuracy = clamp(input.accuracy);
  const coverage = clamp(input.coverage);
  const consistency = clamp(input.consistency);
  const fsrsHealth = clamp(input.fsrsHealth);
  const volume = normalizeVolume(input.questionsVolume);

  // V2 Weights: more emphasis on accuracy and retention
  // accuracy (30%) + coverage (20%) + consistency (10%) + fsrs (20%) + volume (20%)
  const base =
    accuracy * 0.30 +
    coverage * 0.20 +
    consistency * 0.10 +
    fsrsHealth * 0.20 +
    volume * 0.20;

  // Apply TRI/Difficulty factor (V2)
  const triFactor = input.difficultyFactor ?? 1.0;
  let score = base * triFactor;
  let penalty = 0;

  // Inatividade aguda
  if ((input.questions7d ?? 0) === 0) {
    score *= 0.6;
    penalty += base * 0.4;
  }
  // Backlog de revisões
  if ((input.fsrsDue ?? 0) > 100) {
    score -= 10;
    penalty += 10;
  }
  // Reta final com baixo volume
  if (input.daysToExam !== null && input.daysToExam < 30 && input.questionsVolume < 100) {
    score -= 15;
    penalty += 15;
  }

  score = Math.round(clamp(score));

  const riskLevel: ApprovalRisk =
    score >= 70 ? "low" :
    score >= 50 ? "medium" : "high";

  const message = buildMessage(score, input);

  return {
    score,
    trend: "stable", // calculado externamente comparando com histórico
    riskLevel,
    message,
    breakdown: {
      accuracy: Math.round(accuracy * 0.35),
      coverage: Math.round(coverage * 0.25),
      consistency: Math.round(consistency * 0.15),
      fsrsHealth: Math.round(fsrsHealth * 0.10),
      volume: Math.round(volume * 0.15),
      penalties: Math.round(penalty),
    },
  };
}

function buildMessage(score: number, input: ApprovalEngineInput): string {
  if ((input.questions7d ?? 0) === 0) {
    return "⚠️ Você está parado há 7 dias. Sem prática, a chance despenca.";
  }
  if (score >= 80) return "🟢 Você está no caminho certo da aprovação.";
  if (score >= 70) return "🟢 Boa chance de aprovação. Mantenha o ritmo.";
  if (score >= 50) {
    if (input.daysToExam !== null && input.daysToExam < 60) {
      return "🟡 Você está competitivo, mas precisa intensificar agora.";
    }
    return "🟡 Você está competitivo. Aumente o volume para garantir.";
  }
  if (score >= 30) {
    return "🟠 Risco de reprovação. É hora de aumentar consistência e cobertura.";
  }
  return "🔴 Com esse ritmo atual, você NÃO passa. Ajuste urgente.";
}

/**
 * Compara score atual com histórico (últimos snapshots) e retorna trend.
 * delta > +3 → up, delta < -3 → down.
 */
export function calculateTrend(currentScore: number, previousScore: number | null): ApprovalTrend {
  if (previousScore === null || previousScore === undefined) return "stable";
  const delta = currentScore - previousScore;
  if (delta > 3) return "up";
  if (delta < -3) return "down";
  return "stable";
}

/**
 * Helpers de UI (cores semânticas conforme design tokens).
 */
export function approvalToneClass(risk: ApprovalRisk): string {
  return {
    low: "text-emerald-600 dark:text-emerald-400",
    medium: "text-amber-600 dark:text-amber-400",
    high: "text-destructive",
  }[risk];
}

export function approvalBadgeBg(risk: ApprovalRisk): string {
  return {
    low: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    medium: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
    high: "bg-destructive/10 border-destructive/30 text-destructive",
  }[risk];
}

/**
 * Derive a short, action-oriented "current focus" line from the prediction.
 * Used by Hero / ProgressOverview to tell the student where energy must go now.
 */
export function getApprovalFocus(input: {
  riskLevel: ApprovalRisk;
  trend: ApprovalTrend;
  daysToExam: number | null;
}): { focus: string; urgentCopy: string | null } {
  const { riskLevel, trend, daysToExam } = input;
  const isFinalStretch = daysToExam !== null && daysToExam < 30;

  if (riskLevel === "high") {
    return {
      focus: "Foco atual: recuperar volume e revisão",
      urgentCopy: isFinalStretch
        ? "Reta final crítica. Cada sessão conta agora."
        : "Sua aprovação está em risco. Vamos corrigir agora.",
    };
  }
  if (trend === "down") {
    return {
      focus: "Foco atual: recuperar consistência e revisar erros",
      urgentCopy: "Seu desempenho caiu. Vamos corrigir agora.",
    };
  }
  if (riskLevel === "medium") {
    return {
      focus: "Foco atual: consolidar cobertura e ritmo",
      urgentCopy: null,
    };
  }
  // low
  return {
    focus: "Foco atual: manter ritmo e refinar pontos fracos",
    urgentCopy: null,
  };
}
