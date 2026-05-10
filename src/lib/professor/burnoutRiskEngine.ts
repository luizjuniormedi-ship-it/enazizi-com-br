/**
 * burnoutRiskEngine
 * Heurística determinística (sem LLM) para classificar burnout/overload.
 */

export interface BurnoutInputs {
  avg_lapses: number | null;
  retention_score: number | null; // 0-100
  inactive_days: number;
  streak: number;
  completion_rate: number; // 0-100
  overload_score: number;
  accuracy_recent: number | null;
  accuracy_prev: number | null;
}

export interface BurnoutRisk {
  level: "low" | "moderate" | "high";
  score: number;
  signals: string[];
  recommendation: "maintain" | "reduce_load" | "recovery_mode" | "mentoria";
}

export function computeBurnoutRisk(i: BurnoutInputs): BurnoutRisk {
  const signals: string[] = [];
  let score = 0;

  const haveData =
    i.avg_lapses !== null ||
    i.retention_score !== null ||
    i.accuracy_recent !== null;
  if (!haveData) {
    return { level: "low", score: 0, signals: ["dados insuficientes"], recommendation: "maintain" };
  }

  if ((i.avg_lapses ?? 0) >= 3) {
    score += 25;
    signals.push("lapses elevados");
  }
  if ((i.retention_score ?? 100) < 65) {
    score += 25;
    signals.push("retenção baixa");
  }
  if (i.overload_score > 30) {
    score += 20;
    signals.push("carga acima do saudável");
  }
  if (
    i.accuracy_recent !== null &&
    i.accuracy_prev !== null &&
    i.accuracy_recent < i.accuracy_prev - 10
  ) {
    score += 20;
    signals.push("queda de acurácia recente");
  }
  if (i.inactive_days >= 14) {
    // abandono — não é burnout
    return {
      level: "low",
      score,
      signals: [...signals, "inatividade prolongada (provável abandono, não burnout)"],
      recommendation: "mentoria",
    };
  }

  const level: BurnoutRisk["level"] = score >= 50 ? "high" : score >= 25 ? "moderate" : "low";
  let recommendation: BurnoutRisk["recommendation"] = "maintain";
  if (level === "high") recommendation = "recovery_mode";
  else if (level === "moderate") recommendation = "reduce_load";

  return { level, score: Math.min(100, score), signals, recommendation };
}
