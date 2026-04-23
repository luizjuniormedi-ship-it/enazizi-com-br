/**
 * classificationHealth.ts
 * Health verdict automático para runs de classify-question-hierarchy.
 * Usado tanto no Runner quanto no Health Dashboard.
 */

export type HealthVerdict = "healthy" | "borderline" | "rejected" | null;
export type HealthSeverity = "info" | "warning" | "critical";

export interface HealthRunInput {
  total_processed?: number | null;
  deterministic_pct?: number | null;
  heuristic_pct?: number | null;
  queue_pct?: number | null;
  skipped_pct?: number | null;
}

export interface HealthEvaluation {
  verdict: HealthVerdict;
  severity: HealthSeverity;
  reasons: string[];
}

/**
 * Avalia uma run de classificação e retorna verdict + razões.
 *
 * HEALTHY:    deterministic >= 85, skipped < 5, queue < 10
 * BORDERLINE: deterministic 70-84, skipped 5-10, queue 10-20
 * REJECTED:   deterministic < 70, skipped > 10, queue > 20
 */
export function evaluateClassificationHealth(run: HealthRunInput): HealthEvaluation {
  const total = run.total_processed ?? 0;
  if (total <= 0) {
    return {
      verdict: null,
      severity: "info",
      reasons: ["Sem dados processados nesta run."],
    };
  }

  const det = run.deterministic_pct ?? 0;
  const queue = run.queue_pct ?? 0;
  const skipped = run.skipped_pct ?? 0;

  const reasons: string[] = [];
  let verdict: HealthVerdict = "healthy";
  let severity: HealthSeverity = "info";

  // Determinístico (exact + alias)
  if (det < 70) {
    verdict = "rejected";
    severity = "critical";
    reasons.push(`Determinístico ${det}% (< 70%) — pipeline insuficiente.`);
  } else if (det < 85) {
    if (verdict !== "rejected") {
      verdict = "borderline";
      severity = severity === "critical" ? severity : "warning";
    }
    reasons.push(`Determinístico ${det}% (esperado ≥ 85%).`);
  }

  // Skipped
  if (skipped > 10) {
    verdict = "rejected";
    severity = "critical";
    reasons.push(`Skipped ${skipped}% (> 10%) — muitas questões abandonadas.`);
  } else if (skipped >= 5) {
    if (verdict !== "rejected") {
      verdict = "borderline";
      severity = severity === "critical" ? severity : "warning";
    }
    reasons.push(`Skipped ${skipped}% (esperado < 5%).`);
  }

  // Queue
  if (queue > 20) {
    verdict = "rejected";
    severity = "critical";
    reasons.push(`Fila de revisão ${queue}% (> 20%) — sobrecarga manual.`);
  } else if (queue > 10) {
    if (verdict !== "rejected") {
      verdict = "borderline";
      severity = severity === "critical" ? severity : "warning";
    }
    reasons.push(`Fila de revisão ${queue}% (esperado < 10%).`);
  }

  if (verdict === "healthy") {
    reasons.push("Distribuição dentro de todos os thresholds.");
  }

  return { verdict, severity, reasons };
}

export function verdictColor(verdict: HealthVerdict): string {
  switch (verdict) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "borderline":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "rejected":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function verdictLabel(verdict: HealthVerdict): string {
  switch (verdict) {
    case "healthy":
      return "Healthy";
    case "borderline":
      return "Borderline";
    case "rejected":
      return "Rejected";
    default:
      return "Sem dados";
  }
}
