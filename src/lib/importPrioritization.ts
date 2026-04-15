/**
 * Motor de priorização inteligente para ingestão de assets multimodais.
 * Decide o que importar primeiro com base em: relevância de prova, gaps do banco,
 * fraquezas dos alunos e balanceamento de inventário.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export type PriorityMode = "exam_relevance" | "student_weakness" | "inventory_balance" | "hybrid";

export interface DiagnosisRanking {
  diagnosis: string;
  rank: number;
  exam_weight: number;
}

export interface GapReport {
  image_type: string;
  total_assets: number;
  total_questions: number;
  assets_without_questions: number;
  diagnosis_distribution: { diagnosis: string; count: number; with_questions: number }[];
  difficulty_distribution: { easy: number; medium: number; hard: number };
  missing_diagnoses: string[];
  saturated_diagnoses: string[];
  difficulty_gaps: { need_easy: number; need_medium: number; need_hard: number };
  weakness_areas: { image_type: string; avg_accuracy: number; total_attempts: number }[];
  computed_at: string;
}

export interface PrioritizedItem {
  diagnosis: string;
  image_type: string;
  difficulty: string;
  priority_score: number;
  reason: string;
  components: {
    exam_score: number;
    gap_score: number;
    weakness_score: number;
  };
}

export interface PriorityConfig {
  image_type: string;
  diagnosis_rankings: DiagnosisRanking[];
  difficulty_targets: { easy: number; medium: number; hard: number };
  min_assets_per_diagnosis: number;
  max_assets_per_diagnosis: number;
  priority_mode: PriorityMode;
  weight_exam_relevance: number;
  weight_student_weakness: number;
  weight_inventory_gap: number;
}

// ── Fetch Config ──

export async function fetchPriorityConfig(imageType: string): Promise<PriorityConfig | null> {
  const { data } = await (supabase as any)
    .from("import_priority_config")
    .select("*")
    .eq("image_type", imageType)
    .eq("is_active", true)
    .single();
  if (!data) return null;
  return {
    image_type: data.image_type,
    diagnosis_rankings: data.diagnosis_rankings as DiagnosisRanking[],
    difficulty_targets: data.difficulty_targets as any,
    min_assets_per_diagnosis: data.min_assets_per_diagnosis,
    max_assets_per_diagnosis: data.max_assets_per_diagnosis,
    priority_mode: data.priority_mode as PriorityMode,
    weight_exam_relevance: Number(data.weight_exam_relevance),
    weight_student_weakness: Number(data.weight_student_weakness),
    weight_inventory_gap: Number(data.weight_inventory_gap),
  };
}

// ── Gap Analysis ──

export async function computeGapReport(imageType: string): Promise<GapReport> {
  // Use the DB function
  const { data: raw } = await (supabase as any).rpc("compute_content_gaps", { p_image_type: imageType });

  const gaps = raw || {};
  const diagDist = (gaps.diagnosis_distribution || []) as { diagnosis: string; count: number; with_questions: number }[];
  const diffDist = gaps.difficulty_distribution || { easy: 0, medium: 0, hard: 0 };
  const totalAssets = gaps.total_assets || 0;

  // Load config to find missing diagnoses
  const config = await fetchPriorityConfig(imageType);
  const existingDiagnoses = new Set(diagDist.map(d => d.diagnosis.toLowerCase()));
  const missing = config
    ? config.diagnosis_rankings
        .filter(r => !existingDiagnoses.has(r.diagnosis.toLowerCase()))
        .map(r => r.diagnosis)
    : [];

  const saturated = config
    ? diagDist
        .filter(d => d.count >= (config.max_assets_per_diagnosis || 15))
        .map(d => d.diagnosis)
    : [];

  // Difficulty gaps
  const targetEasy = Math.round(totalAssets * 0.25);
  const targetMed = Math.round(totalAssets * 0.40);
  const targetHard = Math.round(totalAssets * 0.35);

  // Weakness data
  const { data: weaknesses } = await (supabase as any)
    .from("visual_skill_snapshots")
    .select("image_type, accuracy, attempts_count")
    .eq("weakest_area", true);

  const weaknessAreas = (weaknesses || []).reduce((acc: any[], w: any) => {
    const existing = acc.find((a: any) => a.image_type === w.image_type);
    if (existing) {
      existing.total_attempts += w.attempts_count || 0;
      existing.sum_acc += (w.accuracy || 0) * (w.attempts_count || 1);
      existing.count++;
    } else {
      acc.push({
        image_type: w.image_type,
        total_attempts: w.attempts_count || 0,
        sum_acc: (w.accuracy || 0) * (w.attempts_count || 1),
        count: 1,
        avg_accuracy: 0,
      });
    }
    return acc;
  }, []).map((a: any) => ({ ...a, avg_accuracy: a.count > 0 ? a.sum_acc / Math.max(a.total_attempts, 1) : 0 }));

  return {
    image_type: imageType,
    total_assets: totalAssets,
    total_questions: gaps.total_questions || 0,
    assets_without_questions: gaps.assets_without_questions || 0,
    diagnosis_distribution: diagDist,
    difficulty_distribution: diffDist,
    missing_diagnoses: missing,
    saturated_diagnoses: saturated,
    difficulty_gaps: {
      need_easy: Math.max(0, targetEasy - (diffDist.easy || 0)),
      need_medium: Math.max(0, targetMed - (diffDist.medium || 0)),
      need_hard: Math.max(0, targetHard - (diffDist.hard || 0)),
    },
    weakness_areas: weaknessAreas,
    computed_at: new Date().toISOString(),
  };
}

// ── Priority Scoring ──

export function computeImportPriorityScore(
  diagnosis: string,
  difficulty: string,
  imageType: string,
  config: PriorityConfig,
  gap: GapReport,
): PrioritizedItem {
  // A. Exam relevance (0-100)
  const ranking = config.diagnosis_rankings.find(
    r => r.diagnosis.toLowerCase() === diagnosis.toLowerCase()
  );
  const examScore = ranking ? ranking.exam_weight * 10 : 20; // unlisted = low priority

  // B. Inventory gap (0-100)
  const diagEntry = gap.diagnosis_distribution.find(
    d => d.diagnosis.toLowerCase() === diagnosis.toLowerCase()
  );
  const currentCount = diagEntry?.count || 0;
  let gapScore = 0;
  if (currentCount === 0) gapScore = 100; // completely missing
  else if (currentCount < config.min_assets_per_diagnosis) gapScore = 80;
  else if (currentCount >= config.max_assets_per_diagnosis) gapScore = 0; // saturated
  else gapScore = Math.max(0, 60 - currentCount * 5);

  // Difficulty gap bonus
  const dg = gap.difficulty_gaps;
  if (difficulty === "easy" && dg.need_easy > 0) gapScore += 15;
  if (difficulty === "medium" && dg.need_medium > 0) gapScore += 10;
  if (difficulty === "hard" && dg.need_hard > 0) gapScore += 10;

  // C. Student weakness (0-100)
  const weakness = gap.weakness_areas.find(w => w.image_type === imageType);
  let weaknessScore = 30; // baseline
  if (weakness) {
    weaknessScore = Math.max(0, 100 - weakness.avg_accuracy * 100);
  }

  // Composite
  const w = config;
  const score = Math.round(
    examScore * w.weight_exam_relevance +
    gapScore * w.weight_inventory_gap +
    weaknessScore * w.weight_student_weakness
  );

  const reasons: string[] = [];
  if (examScore >= 80) reasons.push("alta relevância para prova");
  if (gapScore >= 80) reasons.push("diagnóstico ausente ou sub-representado");
  if (weaknessScore >= 60) reasons.push("fraqueza frequente dos alunos");
  if (currentCount >= config.max_assets_per_diagnosis) reasons.push("categoria saturada");

  return {
    diagnosis,
    image_type: imageType,
    difficulty,
    priority_score: Math.min(100, Math.max(0, score)),
    reason: reasons.join("; ") || "prioridade padrão",
    components: { exam_score: examScore, gap_score: gapScore, weakness_score: weaknessScore },
  };
}

// ── Plan Next Batch ──

export async function planNextBatch(
  imageType: string,
  batchSize: number = 5
): Promise<{ items: PrioritizedItem[]; gap: GapReport; config: PriorityConfig | null }> {
  const config = await fetchPriorityConfig(imageType);
  const gap = await computeGapReport(imageType);

  if (!config) {
    return { items: [], gap, config: null };
  }

  // Score all possible diagnoses from config
  const difficulties: string[] = ["easy", "medium", "hard"];
  const allItems: PrioritizedItem[] = [];

  for (const ranking of config.diagnosis_rankings) {
    for (const diff of difficulties) {
      const item = computeImportPriorityScore(
        ranking.diagnosis, diff, imageType, config, gap
      );
      if (item.priority_score > 0) {
        allItems.push(item);
      }
    }
  }

  // Sort by priority descending
  allItems.sort((a, b) => b.priority_score - a.priority_score);

  // Take top N, avoiding too many of same diagnosis
  const selected: PrioritizedItem[] = [];
  const diagCount: Record<string, number> = {};

  for (const item of allItems) {
    if (selected.length >= batchSize) break;
    const key = item.diagnosis;
    if ((diagCount[key] || 0) >= 2) continue; // max 2 per diagnosis per batch
    selected.push(item);
    diagCount[key] = (diagCount[key] || 0) + 1;
  }

  return { items: selected, gap, config };
}

// ── Summary for UI ──

export interface OptimizationReport {
  imageType: string;
  totalAssets: number;
  totalQuestions: number;
  missingDiagnoses: string[];
  saturatedDiagnoses: string[];
  difficultyBalance: { easy: number; medium: number; hard: number };
  topPriorities: PrioritizedItem[];
  studentWeakness: { area: string; accuracy: number }[];
  priorityMode: string;
}

export async function generateOptimizationReport(imageType: string): Promise<OptimizationReport> {
  const { items, gap, config } = await planNextBatch(imageType, 10);

  return {
    imageType,
    totalAssets: gap.total_assets,
    totalQuestions: gap.total_questions,
    missingDiagnoses: gap.missing_diagnoses,
    saturatedDiagnoses: gap.saturated_diagnoses,
    difficultyBalance: gap.difficulty_distribution,
    topPriorities: items,
    studentWeakness: gap.weakness_areas.map(w => ({
      area: w.image_type,
      accuracy: w.avg_accuracy,
    })),
    priorityMode: config?.priority_mode || "hybrid",
  };
}
