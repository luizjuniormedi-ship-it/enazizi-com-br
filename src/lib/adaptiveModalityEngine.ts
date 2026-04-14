/**
 * Motor Adaptativo por Modalidade — camada adicional sobre o fluxo existente.
 * Usa dados de `simulado_question_analytics` para ajustar a composição do
 * próximo simulado sem quebrar o pipeline atual.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ───

export interface ModalityPriority {
  /** 0-1 score — higher = more priority in next exam */
  score: number;
  /** Preferred format for this modality */
  formatPreference: "image" | "text" | "fallback_text";
  /** Suggested difficulty override */
  difficultyAdjustment: "facil" | "intermediario" | "dificil" | "misto" | null;
  /** Why this modality was prioritised */
  reason: string;
}

export interface AdaptiveBlueprint {
  modalitiesPriority: Record<string, ModalityPriority>;
  /** Adjusted image type distribution (sums to ~1.0) for calculateImageSlots */
  imageTypeDistribution: Record<string, number>;
  /** Adjusted overall image percent (default 20, adaptive 15-30) */
  imagePercent: number;
  /** Auto-generated insights for the student panel */
  insights: AdaptiveInsight[];
}

export interface AdaptiveInsight {
  type: "priority" | "reduction" | "format" | "info";
  message: string;
  modality?: string;
}

// ─── Constants ───

const ALL_MODALITIES = ["ecg", "xray", "dermatology", "ct", "us", "pathology", "ophthalmology"];

const MODALITY_LABELS: Record<string, string> = {
  ecg: "ECG", xray: "RX", dermatology: "Dermatologia",
  ct: "TC", us: "US", pathology: "Patologia", ophthalmology: "Oftalmologia",
};

/** Base exam incidence weights (approximate, ENARE-style) */
const BASE_INCIDENCE: Record<string, number> = {
  ecg: 0.25, xray: 0.25, dermatology: 0.15,
  ct: 0.15, us: 0.10, pathology: 0.05, ophthalmology: 0.05,
};

/** Max/min percentage any single modality can occupy */
const MAX_MODALITY_SHARE = 0.35;
const MIN_MODALITY_SHARE = 0.05;

// ─── Raw data fetching ───

interface RawAnalyticsRow {
  mode: string;
  image_type: string | null;
  is_correct: boolean;
  response_time_seconds: number | null;
  viewed_explanation: boolean;
  changed_answer: boolean;
  retried_image: boolean;
  difficulty: string | null;
}

async function fetchUserRawAnalytics(userId: string): Promise<RawAnalyticsRow[]> {
  const { data } = await (supabase as any)
    .from("simulado_question_analytics")
    .select("mode, image_type, is_correct, response_time_seconds, viewed_explanation, changed_answer, retried_image, difficulty")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data || []) as RawAnalyticsRow[];
}

// ─── Core engine ───

interface ModalityMetrics {
  total: number;
  correct: number;
  errorRate: number;
  avgTime: number;
  explanationRate: number;
  changeRate: number;
  imageTotal: number;
  textTotal: number;
  imageCorrect: number;
  textCorrect: number;
}

function computeMetrics(rows: RawAnalyticsRow[]): Record<string, ModalityMetrics> {
  const metrics: Record<string, ModalityMetrics> = {};

  for (const mod of ALL_MODALITIES) {
    metrics[mod] = {
      total: 0, correct: 0, errorRate: 0, avgTime: 0,
      explanationRate: 0, changeRate: 0,
      imageTotal: 0, textTotal: 0, imageCorrect: 0, textCorrect: 0,
    };
  }

  // Global avg time for relative comparison
  const allTimes = rows.filter(r => r.response_time_seconds && r.response_time_seconds > 0).map(r => r.response_time_seconds!);
  const globalAvgTime = allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 60;

  for (const row of rows) {
    const mod = row.image_type || "__text__";
    if (!metrics[mod]) continue; // skip non-modality rows

    metrics[mod].total++;
    if (row.is_correct) metrics[mod].correct++;
    if (row.viewed_explanation) metrics[mod].explanationRate++;
    if (row.changed_answer) metrics[mod].changeRate++;

    if (row.mode === "image") {
      metrics[mod].imageTotal++;
      if (row.is_correct) metrics[mod].imageCorrect++;
    } else {
      metrics[mod].textTotal++;
      if (row.is_correct) metrics[mod].textCorrect++;
    }

    if (row.response_time_seconds && row.response_time_seconds > 0) {
      metrics[mod].avgTime += row.response_time_seconds;
    }
  }

  // Normalise
  for (const mod of ALL_MODALITIES) {
    const m = metrics[mod];
    if (m.total > 0) {
      m.errorRate = ((m.total - m.correct) / m.total) * 100;
      m.explanationRate = (m.explanationRate / m.total) * 100;
      m.changeRate = (m.changeRate / m.total) * 100;
      m.avgTime = m.avgTime > 0 ? m.avgTime / m.total : 0;
    }
  }

  return metrics;
}

/**
 * Generate the adaptive blueprint for a user.
 * This is the main entry point — call before assembling a simulado.
 */
export async function generateAdaptiveBlueprint(userId: string): Promise<AdaptiveBlueprint> {
  const rows = await fetchUserRawAnalytics(userId);

  // Fetch visual_skill_snapshots for richer adaptation
  let visualSnapshots: Array<{ image_type: string; accuracy: number; trend: string; attempts_count: number }> = [];
  try {
    const { data } = await supabase
      .from("visual_skill_snapshots")
      .select("image_type, accuracy, trend, attempts_count")
      .eq("user_id", userId);
    visualSnapshots = (data || []) as any[];
  } catch { /* non-blocking */ }

  // If no analytics data but we have visual snapshots, still adapt
  if (rows.length < 10 && visualSnapshots.length === 0) {
    return buildNeutralBlueprint();
  }

  const metrics = computeMetrics(rows);

  // Global avg time for relative scoring
  const allAvgTimes = ALL_MODALITIES.map(m => metrics[m].avgTime).filter(t => t > 0);
  const globalAvgTime = allAvgTimes.length > 0 ? allAvgTimes.reduce((a, b) => a + b, 0) / allAvgTimes.length : 60;

  const priorities: Record<string, ModalityPriority> = {};
  const insights: AdaptiveInsight[] = [];
  const rawScores: Record<string, number> = {};

  for (const mod of ALL_MODALITIES) {
    const m = metrics[mod];
    const incidence = BASE_INCIDENCE[mod] || 0.05;
    const label = MODALITY_LABELS[mod] || mod.toUpperCase();

    if (m.total < 3) {
      // Not enough data — use base incidence
      rawScores[mod] = incidence * 10;
      priorities[mod] = {
        score: incidence,
        formatPreference: "image",
        difficultyAdjustment: null,
        reason: "Dados insuficientes — peso padrão",
      };
      continue;
    }

    // Priority formula
    const errorPct = m.errorRate; // 0-100
    const timeRelative = globalAvgTime > 0 ? Math.max(0, (m.avgTime - globalAvgTime) / globalAvgTime) * 100 : 0;
    const explUsage = m.explanationRate; // 0-100
    const changeUsage = m.changeRate; // 0-100
    const incidenceScore = incidence * 100; // 0-100 scale
    const dominance = m.total / Math.max(rows.length, 1) * 100; // how much this modality already appeared

    const score =
      (errorPct * 3) +
      (timeRelative * 2) +
      (explUsage * 1) +
      (changeUsage * 1) +
      (incidenceScore * 3) +
      // reduce if already over-represented
      (-dominance * 2);

    rawScores[mod] = Math.max(0, score);

    // Format preference: if student does worse on image than text for this modality, prioritise image
    let formatPref: "image" | "text" | "fallback_text" = "image";
    if (m.imageTotal >= 3 && m.textTotal >= 3) {
      const imageAcc = m.imageTotal > 0 ? (m.imageCorrect / m.imageTotal) * 100 : 0;
      const textAcc = m.textTotal > 0 ? (m.textCorrect / m.textTotal) * 100 : 0;
      if (textAcc > imageAcc + 15) {
        formatPref = "image"; // student weaker in image → prioritise image practice
        insights.push({
          type: "format",
          modality: mod,
          message: `Você acerta mais ${label} em texto do que com imagem. Próximo simulado trará mais questões visuais de ${label}.`,
        });
      }
    }

    // Difficulty adjustment
    let diffAdj: "facil" | "intermediario" | "dificil" | "misto" | null = null;
    if (m.errorRate > 70) {
      diffAdj = "intermediario"; // too many errors → ease slightly
    } else if (m.errorRate < 25 && m.total >= 5) {
      diffAdj = "dificil"; // too easy → ramp up
      insights.push({
        type: "reduction",
        modality: mod,
        message: `Bom domínio em ${label} (${Math.round(100 - m.errorRate)}% acerto). Dificuldade será elevada.`,
      });
    }

    // Generate insight for high-priority modalities
    if (m.errorRate > 50) {
      insights.push({
        type: "priority",
        modality: mod,
        message: `${label} será priorizado no próximo simulado por baixo desempenho (${Math.round(100 - m.errorRate)}% acerto).`,
      });
    }

    priorities[mod] = {
      score: 0, // will be normalised below
      formatPreference: formatPref,
      difficultyAdjustment: diffAdj,
      reason: m.errorRate > 50
        ? `Alto erro (${Math.round(m.errorRate)}%) → priorizado`
        : m.errorRate < 25
          ? `Bom domínio (${Math.round(100 - m.errorRate)}%) → manutenção`
          : `Desempenho médio → peso padrão`,
    };
  }

  // ── Boost from visual_skill_snapshots (persisted from Image Quiz) ──
  for (const snap of visualSnapshots) {
    const mod = snap.image_type?.toLowerCase();
    if (!mod || !rawScores.hasOwnProperty(mod)) continue;
    const label = MODALITY_LABELS[mod] || mod.toUpperCase();
    // Weak snapshot → boost priority
    if (snap.accuracy < 50) {
      rawScores[mod] += 80;
      insights.push({ type: "priority", modality: mod, message: `${label} está fraco no quiz visual (${snap.accuracy}%) → priorizado no simulado.` });
    } else if (snap.accuracy < 70) {
      rawScores[mod] += 40;
    }
    // Declining trend → extra boost
    if (snap.trend === "declining") {
      rawScores[mod] += 30;
      insights.push({ type: "priority", modality: mod, message: `Seu desempenho em ${label} está piorando → reforço no simulado.` });
    }
  }

  // Normalise scores to 0-1, respecting min/max share
  const totalRaw = Object.values(rawScores).reduce((a, b) => a + b, 0) || 1;
  const imageTypeDist: Record<string, number> = {};

  for (const mod of ALL_MODALITIES) {
    let normalised = rawScores[mod] / totalRaw;
    normalised = Math.min(MAX_MODALITY_SHARE, Math.max(MIN_MODALITY_SHARE, normalised));
    priorities[mod].score = Math.round(normalised * 100) / 100;
    imageTypeDist[mod] = normalised;
  }

  // Re-normalise distribution to sum to 1.0
  const distSum = Object.values(imageTypeDist).reduce((a, b) => a + b, 0) || 1;
  for (const mod of ALL_MODALITIES) {
    imageTypeDist[mod] = Math.round((imageTypeDist[mod] / distSum) * 100) / 100;
  }

  // Determine adaptive image percent (15-30% based on how much the student needs image practice)
  const overallImageRows = rows.filter(r => r.mode === "image");
  const overallImageAcc = overallImageRows.length > 0
    ? overallImageRows.filter(r => r.is_correct).length / overallImageRows.length
    : 0.5;
  // Lower image accuracy → higher image percent (more practice)
  const imagePercent = Math.round(15 + (1 - overallImageAcc) * 15); // 15-30%

  return {
    modalitiesPriority: priorities,
    imageTypeDistribution: imageTypeDist,
    imagePercent: Math.min(30, Math.max(15, imagePercent)),
    insights,
  };
}

function buildNeutralBlueprint(): AdaptiveBlueprint {
  const priorities: Record<string, ModalityPriority> = {};
  for (const mod of ALL_MODALITIES) {
    priorities[mod] = {
      score: BASE_INCIDENCE[mod] || 0.05,
      formatPreference: "image",
      difficultyAdjustment: null,
      reason: "Sem dados adaptativos — peso padrão",
    };
  }
  return {
    modalitiesPriority: priorities,
    imageTypeDistribution: { ecg: 0.40, xray: 0.30, dermatology: 0.30 },
    imagePercent: 20,
    insights: [],
  };
}

/**
 * Convenience: get a summary object for the student panel.
 */
export function getBlueprintSummary(bp: AdaptiveBlueprint): {
  topPriorities: { modality: string; label: string; score: number; reason: string }[];
  imagePercent: number;
  insights: AdaptiveInsight[];
} {
  const sorted = Object.entries(bp.modalitiesPriority)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 4)
    .map(([mod, p]) => ({
      modality: mod,
      label: MODALITY_LABELS[mod] || mod.toUpperCase(),
      score: p.score,
      reason: p.reason,
    }));

  return {
    topPriorities: sorted,
    imagePercent: bp.imagePercent,
    insights: bp.insights,
  };
}
