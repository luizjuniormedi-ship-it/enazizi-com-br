/**
 * questionDistributionEngine — Estratégia de mix de questões
 * ──────────────────────────────────────────────────────────────
 * Função pura que calcula a **distribuição percentual ideal** entre
 * 4 categorias pedagógicas, com base em:
 *   - dias até a prova
 *   - cobertura curricular atual
 *   - quantidade de erros pendentes
 *   - se o aluno está atrasado na meta
 *
 * Categorias:
 *   - coverage  → temas nunca vistos (conteúdo novo / lacunas críticas)
 *   - error     → reforço de erros (error_bank)
 *   - revision  → revisão FSRS
 *   - incidence → questões de prova (alta incidência na banca)
 *
 * Saída sempre normalizada para somar 100.
 *
 * NÃO altera schema, NÃO faz I/O — função pura.
 */

export type DistributionCategory = "coverage" | "error" | "revision" | "incidence";

export type Distribution = Record<DistributionCategory, number>;

export interface DistributionInput {
  /** Dias restantes até a prova (null se não houver data) */
  daysUntilExam?: number | null;
  /** Percentual de cobertura curricular obrigatória atingido (0–100) */
  coveragePct?: number;
  /** Quantidade de erros ativos no error_bank */
  errorCount?: number;
  /** Aluno está atrasado na meta de questões? */
  isBehindGoal?: boolean;
}

export interface DistributionResult {
  distribution: Distribution;
  /** Quantidades absolutas se houver `dailyTarget` na chamada */
  dailyQuantities?: Distribution;
  reason: string;
  phase: "long_term" | "mid_term" | "final_stretch";
}

function baseDistribution(daysUntilExam: number | null | undefined): {
  dist: Distribution;
  phase: DistributionResult["phase"];
} {
  if (daysUntilExam !== null && daysUntilExam !== undefined && daysUntilExam <= 30) {
    // Reta final: muita revisão + erro, pouco conteúdo novo
    return {
      dist: { coverage: 10, error: 35, revision: 35, incidence: 20 },
      phase: "final_stretch",
    };
  }
  if (daysUntilExam !== null && daysUntilExam !== undefined && daysUntilExam <= 60) {
    // Médio prazo: equilíbrio
    return {
      dist: { coverage: 25, error: 30, revision: 25, incidence: 20 },
      phase: "mid_term",
    };
  }
  // Longe da prova (ou sem data): foco em cobrir conteúdo
  return {
    dist: { coverage: 40, error: 25, revision: 15, incidence: 20 },
    phase: "long_term",
  };
}

function normalize(d: Distribution): Distribution {
  const sum = d.coverage + d.error + d.revision + d.incidence;
  if (sum <= 0) return { coverage: 25, error: 25, revision: 25, incidence: 25 };
  const scale = 100 / sum;
  // Arredonda mantendo soma = 100 (corrige a maior categoria)
  const rounded: Distribution = {
    coverage: Math.max(0, Math.round(d.coverage * scale)),
    error: Math.max(0, Math.round(d.error * scale)),
    revision: Math.max(0, Math.round(d.revision * scale)),
    incidence: Math.max(0, Math.round(d.incidence * scale)),
  };
  const diff = 100 - (rounded.coverage + rounded.error + rounded.revision + rounded.incidence);
  if (diff !== 0) {
    const keys: DistributionCategory[] = ["coverage", "error", "revision", "incidence"];
    const maxKey = keys.reduce((a, b) => (rounded[a] >= rounded[b] ? a : b));
    rounded[maxKey] += diff;
  }
  return rounded;
}

export function getQuestionDistribution(
  input: DistributionInput & { dailyTarget?: number } = {}
): DistributionResult {
  const { daysUntilExam = null, coveragePct, errorCount = 0, isBehindGoal = false, dailyTarget } = input;

  const { dist: base, phase } = baseDistribution(daysUntilExam);
  const adjusted: Distribution = { ...base };

  const reasons: string[] = [];

  // Ajustes dinâmicos
  if (coveragePct !== undefined && coveragePct < 50) {
    adjusted.coverage += 10;
    adjusted.error = Math.max(0, adjusted.error - 5);
    reasons.push("cobertura baixa (<50%)");
  }
  if (errorCount > 50) {
    adjusted.error += 10;
    reasons.push("muitos erros pendentes");
  }
  if (isBehindGoal) {
    adjusted.incidence += 10;
    reasons.push("atrasado na meta");
  }

  const distribution = normalize(adjusted);

  let dailyQuantities: Distribution | undefined;
  if (typeof dailyTarget === "number" && dailyTarget > 0) {
    dailyQuantities = {
      coverage: Math.round((distribution.coverage / 100) * dailyTarget),
      error: Math.round((distribution.error / 100) * dailyTarget),
      revision: Math.round((distribution.revision / 100) * dailyTarget),
      incidence: Math.round((distribution.incidence / 100) * dailyTarget),
    };
  }

  const phaseLabel =
    phase === "final_stretch" ? "reta final (<30d)" :
    phase === "mid_term" ? "médio prazo (30–60d)" :
    "longo prazo (>60d ou sem prova)";

  const reason = reasons.length > 0
    ? `${phaseLabel} — ajustes: ${reasons.join(", ")}`
    : phaseLabel;

  return { distribution, dailyQuantities, reason, phase };
}
