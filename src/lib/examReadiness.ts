/**
 * Exam Readiness Calculator
 * Estimates approval chance per target exam/banca based on real user data.
 */

import { EXAM_PROFILES, type ExamProfile, type ReadinessWeights, getExamProfile } from "./examProfiles";
import { BASE_CURRICULUM, type CurriculumTopic } from "@/constants/baseCurriculum";

export type ReadinessLabel = "critico" | "risco_alto" | "competitivo" | "forte" | "elite";

export interface ExamReadiness {
  examKey: string;
  examName: string;
  readinessScore: number; // 0-100
  readinessLabel: ReadinessLabel;
  insight: string;
  strongAreas: string[];
  weakAreas: string[];
  /** What's helping most */
  topPositive: string;
  /** What's dragging score down */
  topNegative: string;
  /** Curriculum coverage score 0-100 */
  coverageScore: number;
  /** Number of curriculum topics covered */
  topicsCovered: number;
  /** Total curriculum topics for this banca */
  topicsTotal: number;
}

export interface ReadinessInput {
  approvalScore: number;
  accuracyBySpecialty: Record<string, { correct: number; total: number }>;
  simuladoScores: number[]; // last N scores (0-100)
  practicalScores: number[]; // OSCE/anamnesis scores (0-100)
  overdueReviews: number;
  totalQuestionsAnswered: number;
  streak: number;
  recentAccuracy: number; // last 50 questions accuracy %
  /** Topics already studied by the user (lowercase) */
  studiedTopics?: string[];
}

function getLabel(score: number): ReadinessLabel {
  if (score <= 40) return "critico";
  if (score <= 60) return "risco_alto";
  if (score <= 75) return "competitivo";
  if (score <= 90) return "forte";
  return "elite";
}

const LABEL_PT: Record<ReadinessLabel, string> = {
  critico: "Crítico",
  risco_alto: "Risco Alto",
  competitivo: "Competitivo",
  forte: "Forte",
  elite: "Elite",
};

export function getLabelText(label: ReadinessLabel): string {
  return LABEL_PT[label];
}

/**
 * Get curriculum topics relevant to a specific banca (filtered by specialtyWeights)
 */
function getCurriculumForBanca(profile: ExamProfile): CurriculumTopic[] {
  const bancaSpecs = new Set(Object.keys(profile.specialtyWeights));
  return BASE_CURRICULUM.filter(t => bancaSpecs.has(t.specialty));
}

/**
 * Calculate coverage score: how many banca-relevant curriculum topics the student has studied
 */
function calculateCoverageScore(
  profile: ExamProfile,
  studiedTopics: string[],
): { coverageScore: number; topicsCovered: number; topicsTotal: number } {
  const bancaTopics = getCurriculumForBanca(profile);
  const uniqueTopics = [...new Set(bancaTopics.map(t => t.topic))];
  const topicsTotal = uniqueTopics.length;
  if (topicsTotal === 0) return { coverageScore: 0, topicsCovered: 0, topicsTotal: 0 };

  let covered = 0;
  for (const topic of uniqueTopics) {
    const lower = topic.toLowerCase();
    const isCovered = studiedTopics.some(
      (st) => st.includes(lower.slice(0, 10)) || lower.includes(st.slice(0, 10))
    );
    if (isCovered) covered++;
  }

  // Weight coverage by specialty importance
  const specWeights = profile.specialtyWeights;
  const bySpec: Record<string, { covered: number; total: number }> = {};
  for (const t of bancaTopics) {
    if (!bySpec[t.specialty]) bySpec[t.specialty] = { covered: 0, total: 0 };
    bySpec[t.specialty].total++;
  }
  for (const t of bancaTopics) {
    const lower = t.topic.toLowerCase();
    const isCovered = studiedTopics.some(
      (st) => st.includes(lower.slice(0, 10)) || lower.includes(st.slice(0, 10))
    );
    if (isCovered && bySpec[t.specialty]) bySpec[t.specialty].covered++;
  }

  let weightedCoverage = 0;
  let totalWeight = 0;
  for (const [spec, data] of Object.entries(bySpec)) {
    const w = specWeights[spec] || 10;
    const ratio = data.total > 0 ? data.covered / data.total : 0;
    weightedCoverage += ratio * w;
    totalWeight += w;
  }

  const coverageScore = totalWeight > 0
    ? Math.round((weightedCoverage / totalWeight) * 100)
    : Math.round((covered / topicsTotal) * 100);

  return { coverageScore, topicsCovered: covered, topicsTotal };
}

/**
 * Calculate readiness for a single exam profile
 */
export function calculateExamReadiness(
  input: ReadinessInput,
  examKey: string,
): ExamReadiness {
  const profile = getExamProfile(examKey);
  const weights = profile.specialtyWeights;

  // 1. Weighted accuracy by banca specialty emphasis (30%)
  let weightedAcc = 0;
  let totalWeight = 0;
  const strongAreas: string[] = [];
  const weakAreas: string[] = [];

  for (const [spec, weight] of Object.entries(weights)) {
    const data = input.accuracyBySpecialty[spec];
    if (data && data.total >= 3) {
      const acc = (data.correct / data.total) * 100;
      weightedAcc += acc * (weight / 100);
      totalWeight += weight / 100;
      if (acc >= 70) strongAreas.push(spec);
      else if (acc < 50) weakAreas.push(spec);
    }
  }
  const specScore = totalWeight > 0 ? weightedAcc / totalWeight : input.approvalScore;

  // 2. Base approval score component (20%)
  const baseScore = input.approvalScore;

  // 3. Simulado performance adjusted by difficulty (15%)
  const simAvg = input.simuladoScores.length > 0
    ? input.simuladoScores.reduce((a, b) => a + b, 0) / input.simuladoScores.length
    : 0;
  const difficultyPenalty = (profile.difficulty - 3) * 3;
  const simScore = Math.max(0, simAvg - difficultyPenalty);

  // 4. Curriculum coverage score (10%)
  const { coverageScore, topicsCovered, topicsTotal } = calculateCoverageScore(
    profile, input.studiedTopics || []
  );

  // 5. Practical performance for OSCE-heavy bancas (10%)
  const practAvg = input.practicalScores.length > 0
    ? input.practicalScores.reduce((a, b) => a + b, 0) / input.practicalScores.length
    : 0;
  const practicalMultiplier = profile.osceEmphasis ? 1.3 : 0.7;
  const practScore = practAvg * practicalMultiplier;

  // 6. Consistency & volume (10%)
  const volumeScore = Math.min((input.totalQuestionsAnswered / 500) * 100, 100);
  const streakBonus = Math.min(input.streak * 2, 20);
  const consistencyScore = Math.min(volumeScore * 0.7 + streakBonus + input.recentAccuracy * 0.1, 100);

  // 7. Review penalty (5%)
  const reviewPenalty = Math.min(input.overdueReviews * 2, 30);

  // Use per-banca readiness weights
  const w = profile.readinessWeights;
  const raw =
    specScore * w.specAccuracy +
    baseScore * w.approvalScore +
    simScore * w.simulado +
    coverageScore * w.coverage +
    Math.min(practScore, 100) * w.practical +
    consistencyScore * w.consistency -
    reviewPenalty * w.reviewPenalty;

  const readinessScore = Math.max(0, Math.min(100, Math.round(raw)));
  const readinessLabel = getLabel(readinessScore);

  // Generate insight
  const insight = generateInsight(profile, input, strongAreas, weakAreas, readinessScore, coverageScore);

  // Top positive/negative
  const factors: { label: string; value: number }[] = [
    { label: "Acurácia por especialidade", value: specScore },
    { label: "Score de aprovação geral", value: baseScore },
    { label: "Simulados", value: simScore },
    { label: "Cobertura do cronograma", value: coverageScore },
    { label: "Prática clínica", value: Math.min(practScore, 100) },
    { label: "Consistência e volume", value: consistencyScore },
  ];
  factors.sort((a, b) => b.value - a.value);
  const topPositive = factors[0]?.label || "Estudo consistente";
  const topNegative = factors[factors.length - 1]?.label || "Volume de questões";

  return {
    examKey,
    examName: profile.label,
    readinessScore,
    readinessLabel,
    insight,
    strongAreas: strongAreas.slice(0, 3),
    weakAreas: weakAreas.slice(0, 3),
    topPositive,
    topNegative,
    coverageScore,
    topicsCovered,
    topicsTotal,
  };
}

function generateInsight(
  profile: ExamProfile,
  input: ReadinessInput,
  strongAreas: string[],
  weakAreas: string[],
  score: number,
  coverageScore: number,
): string {
  if (input.totalQuestionsAnswered < 30) {
    return `Continue praticando para termos dados suficientes sobre sua preparação para ${profile.label}.`;
  }

  if (coverageScore < 40 && input.totalQuestionsAnswered >= 50) {
    return `Sua cobertura de temas para ${profile.label} ainda está baixa (${coverageScore}%). Amplie os assuntos estudados.`;
  }

  if (score >= 75 && strongAreas.length >= 2) {
    const top = strongAreas[0];
    return `Seu desempenho em ${top} fortalece sua chance na ${profile.label}.`;
  }

  if (input.overdueReviews > 10) {
    return `Revisões pendentes estão reduzindo sua projeção para ${profile.label}.`;
  }

  if (weakAreas.length >= 2) {
    return `Foque em ${weakAreas.slice(0, 2).join(" e ")} para melhorar na ${profile.label}.`;
  }

  if (coverageScore >= 70 && score < 60) {
    return `Boa cobertura de temas (${coverageScore}%), mas o desempenho precisa melhorar para ${profile.label}.`;
  }

  if (input.simuladoScores.length === 0) {
    return `Faça simulados para refinar sua projeção na ${profile.label}.`;
  }

  if (profile.osceEmphasis && input.practicalScores.length === 0) {
    return `A ${profile.label} cobra prova prática — pratique OSCE e anamnese.`;
  }

  return `Você já cobriu ${coverageScore}% dos temas da ${profile.label}. Continue assim!`;
}

/**
 * Calculate readiness for all target exams
 */
export function calculateAllExamReadiness(
  input: ReadinessInput,
  targetExams: string[],
): ExamReadiness[] {
  if (!targetExams || targetExams.length === 0) return [];
  return targetExams.map((key) => calculateExamReadiness(input, key));
}
