/**
 * visualSkillEngine.ts
 * Computes per-category visual skill scores from medical_image_attempts data.
 * Pure deterministic — no AI calls.
 */

export const VISUAL_CATEGORIES = [
  "ecg", "xray", "ct", "us", "dermatology", "ophthalmology", "pathology",
] as const;

export type VisualCategory = typeof VISUAL_CATEGORIES[number];

export interface VisualCategoryScore {
  imageType: VisualCategory;
  attemptsCount: number;
  correctCount: number;
  accuracy: number;            // 0-100
  avgTimeSeconds: number | null;
  score: number;               // 0-100 composite
  trend: "improving" | "declining" | "stable";
  confidenceLevel: "low" | "medium" | "high";
  recentWindowAccuracy: number | null; // last 10 attempts
}

export interface VisualSkillSummary {
  globalScore: number;         // 0-100
  globalLevel: "critico" | "fraco" | "intermediario" | "bom" | "avancado";
  categories: VisualCategoryScore[];
  strongestArea: VisualCategory | null;
  weakestArea: VisualCategory | null;
  weaknessAlerts: string[];
}

export interface AttemptRow {
  correct: boolean;
  time_seconds: number | null;
  image_type: string | null;
  created_at: string;
}

/**
 * Compute visual skill from raw attempt rows.
 */
export function computeVisualSkill(attempts: AttemptRow[]): VisualSkillSummary {
  const catMap = new Map<string, AttemptRow[]>();

  for (const a of attempts) {
    const t = (a.image_type || "").toLowerCase().trim();
    if (!t) continue;
    if (!catMap.has(t)) catMap.set(t, []);
    catMap.get(t)!.push(a);
  }

  const categories: VisualCategoryScore[] = VISUAL_CATEGORIES.map((cat) => {
    const rows = catMap.get(cat) || [];
    return computeCategoryScore(cat, rows);
  });

  // Filter categories with enough data for ranking
  const ranked = categories.filter((c) => c.attemptsCount >= 3);
  const strongest = ranked.length > 0
    ? ranked.reduce((a, b) => (b.score > a.score ? b : a)).imageType
    : null;
  const weakest = ranked.length > 0
    ? ranked.reduce((a, b) => (b.score < a.score ? b : a)).imageType
    : null;

  // Global score = weighted average of categories with data
  const withData = categories.filter((c) => c.attemptsCount > 0);
  const globalScore = withData.length > 0
    ? Math.round(withData.reduce((sum, c) => sum + c.score * c.attemptsCount, 0) / withData.reduce((sum, c) => sum + c.attemptsCount, 0))
    : 0;

  const weaknessAlerts: string[] = [];
  for (const c of categories) {
    if (c.attemptsCount >= 5 && c.accuracy < 50) {
      weaknessAlerts.push(`Fraqueza crítica em ${labelFor(c.imageType)} (${c.accuracy}% acerto)`);
    } else if (c.attemptsCount >= 5 && c.accuracy < 65) {
      weaknessAlerts.push(`Fraqueza moderada em ${labelFor(c.imageType)} (${c.accuracy}% acerto)`);
    }
    if (c.trend === "declining" && c.attemptsCount >= 5) {
      weaknessAlerts.push(`Desempenho em queda em ${labelFor(c.imageType)}`);
    }
  }

  return {
    globalScore,
    globalLevel: scoreToLevel(globalScore),
    categories,
    strongestArea: strongest,
    weakestArea: weakest,
    weaknessAlerts,
  };
}

function computeCategoryScore(cat: VisualCategory, rows: AttemptRow[]): VisualCategoryScore {
  const n = rows.length;
  if (n === 0) {
    return {
      imageType: cat, attemptsCount: 0, correctCount: 0, accuracy: 0,
      avgTimeSeconds: null, score: 0, trend: "stable",
      confidenceLevel: "low", recentWindowAccuracy: null,
    };
  }

  const correct = rows.filter((r) => r.correct).length;
  const accuracy = Math.round((correct / n) * 100);

  const times = rows.map((r) => r.time_seconds).filter((t): t is number => t != null && t > 0);
  const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  // Sort by date desc for recency
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Recent window = last 10
  const recent = sorted.slice(0, 10);
  const recentCorrect = recent.filter((r) => r.correct).length;
  const recentAcc = recent.length >= 3 ? Math.round((recentCorrect / recent.length) * 100) : null;

  // Trend: compare recent 10 vs older
  let trend: "improving" | "declining" | "stable" = "stable";
  if (n >= 10) {
    const older = sorted.slice(10, 20);
    if (older.length >= 5) {
      const olderAcc = older.filter((r) => r.correct).length / older.length;
      const recentAccRaw = recentCorrect / recent.length;
      const diff = recentAccRaw - olderAcc;
      if (diff > 0.1) trend = "improving";
      else if (diff < -0.1) trend = "declining";
    }
  }

  // Composite score: accuracy (60%) + time bonus (20%) + consistency (20%)
  let score = accuracy * 0.6;

  // Time bonus: faster = better. Baseline: 60s avg is neutral.
  if (avgTime != null) {
    const timeBonus = avgTime <= 30 ? 20 : avgTime <= 60 ? 15 : avgTime <= 90 ? 10 : 5;
    score += timeBonus;
  } else {
    score += 10; // neutral
  }

  // Consistency: recent accuracy close to global = consistent
  if (recentAcc != null) {
    const consistency = 20 - Math.min(20, Math.abs(recentAcc - accuracy) * 0.4);
    score += consistency;
  } else {
    score += 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const confidenceLevel = n >= 15 ? "high" : n >= 5 ? "medium" : "low";

  return {
    imageType: cat, attemptsCount: n, correctCount: correct, accuracy,
    avgTimeSeconds: avgTime, score, trend, confidenceLevel,
    recentWindowAccuracy: recentAcc,
  };
}

function scoreToLevel(s: number): VisualSkillSummary["globalLevel"] {
  if (s < 30) return "critico";
  if (s < 50) return "fraco";
  if (s < 65) return "intermediario";
  if (s < 80) return "bom";
  return "avancado";
}

function labelFor(cat: VisualCategory): string {
  const labels: Record<VisualCategory, string> = {
    ecg: "ECG", xray: "Raio-X", ct: "Tomografia", us: "Ultrassom",
    dermatology: "Dermatologia", ophthalmology: "Oftalmologia", pathology: "Patologia",
  };
  return labels[cat] || cat;
}
