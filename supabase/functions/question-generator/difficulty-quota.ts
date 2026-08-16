export type DifficultyBucket = "easy" | "medium" | "hard";

export type DifficultyMix = Record<DifficultyBucket, number>;

export interface DifficultyQuotaResult<T> {
  questions: T[];
  target: Record<DifficultyBucket, number>;
  actual: Record<DifficultyBucket, number>;
  available: Record<DifficultyBucket, number>;
  shortage: Record<DifficultyBucket, number>;
  exact: boolean;
  historicalReuseCount: number;
  topicTarget?: Record<string, number>;
  topicActual?: Record<string, number>;
  topicShortage?: Record<string, number>;
}

export interface TopicWeight {
  topic: string;
  weight: number;
  subtopics?: Array<{ name: string }>;
}

const VISIBLE_TOPIC_EQUIVALENTS: Record<string, string[]> = {
  "Cirurgia": ["Cirurgia Geral"],
  "Ginecologia e Obstetrícia": ["Ginecologia", "Obstetrícia"],
  "Medicina de Emergência": ["Emergência", "Urgência e Emergência"],
};

const normalizeTopicLabel = (value: unknown) => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ");

export function classifyVisibleTopicBucket(
  question: { topic?: unknown; curriculum_theme?: unknown },
  weights: TopicWeight[],
): { bucket: string; visibleTopic: string } | null {
  const rawTopic = typeof question.topic === "string" && !["geral", "general"].includes(normalizeTopicLabel(question.topic))
    ? question.topic.trim()
    : (typeof question.curriculum_theme === "string" ? question.curriculum_theme.trim() : "");
  const visible = normalizeTopicLabel(rawTopic);
  if (!visible) return null;

  for (const weight of weights) {
    const acceptedLabels = [
      weight.topic,
      ...(weight.subtopics || []).map((subtopic) => subtopic.name),
      ...(VISIBLE_TOPIC_EQUIVALENTS[weight.topic] || []),
    ].map(normalizeTopicLabel);
    if (acceptedLabels.includes(visible)) {
      return { bucket: weight.topic, visibleTopic: rawTopic };
    }
  }

  return null;
}

export const ENARE_DIFFICULTY_MIX: DifficultyMix = {
  easy: 25,
  medium: 50,
  hard: 25,
};

export const GENERAL_DIFFICULTY_MIX: DifficultyMix = {
  easy: 30,
  medium: 50,
  hard: 20,
};

export interface CorpusDifficultyPlan {
  mix: DifficultyMix;
  scale: "corpus-relative-3-4-5-v1";
  calibrationStatus: "experimental";
}

const BUCKETS: DifficultyBucket[] = ["easy", "medium", "hard"];

export function normalizeEnareCorpusDifficulty(value: unknown): DifficultyBucket | "unclassified" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "3") return "easy";
  if (normalized === "4") return "medium";
  if (normalized === "5") return "hard";

  return "unclassified";
}

export function calculateDifficultyTargets(total: number, mix: DifficultyMix) {
  const safeTotal = Math.max(0, Math.floor(total));
  const weights = BUCKETS.map((bucket) => Math.max(0, Number(mix[bucket]) || 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = weights.map((weight) => safeTotal * weight / weightTotal);
  const targets = raw.map(Math.floor);
  let remainder = safeTotal - targets.reduce((sum, value) => sum + value, 0);

  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) targets[remainderOrder[i % remainderOrder.length].index]++;

  return Object.fromEntries(BUCKETS.map((bucket, index) => [bucket, targets[index]])) as Record<DifficultyBucket, number>;
}

export function selectByDifficultyQuota<T extends { id?: unknown; difficulty?: unknown; _historical_reuse?: boolean }>(
  candidates: T[],
  total: number,
  mix: DifficultyMix,
): DifficultyQuotaResult<T> {
  const target = calculateDifficultyTargets(total, mix);
  const indexed = candidates
    .map((question, index) => ({ question, index, bucket: normalizeEnareCorpusDifficulty(question.difficulty) }))
    .sort((a, b) =>
      Number(Boolean(a.question._historical_reuse)) - Number(Boolean(b.question._historical_reuse)) ||
      String(a.question.id ?? a.index).localeCompare(String(b.question.id ?? b.index))
    );
  const queues = Object.fromEntries(BUCKETS.map((bucket) => [bucket, indexed.filter((item) => item.bucket === bucket)])) as Record<DifficultyBucket, typeof indexed>;
  const available = Object.fromEntries(BUCKETS.map((bucket) => [bucket, queues[bucket].length])) as Record<DifficultyBucket, number>;
  const selected: typeof indexed = [];

  for (const bucket of BUCKETS) {
    for (const item of queues[bucket].slice(0, target[bucket])) {
      selected.push(item);
    }
  }

  const questions = selected
    .sort((a, b) => String(a.question.id ?? a.index).localeCompare(String(b.question.id ?? b.index)))
    .slice(0, Math.max(0, Math.floor(total)))
    .map((item) => item.question);
  const actual = { easy: 0, medium: 0, hard: 0 } satisfies Record<DifficultyBucket, number>;
  for (const question of questions) {
    const bucket = normalizeEnareCorpusDifficulty(question.difficulty);
    if (bucket !== "unclassified") actual[bucket]++;
  }
  const shortage = Object.fromEntries(
    BUCKETS.map((bucket) => [bucket, Math.max(0, target[bucket] - actual[bucket])]),
  ) as Record<DifficultyBucket, number>;

  return {
    questions,
    target,
    actual,
    available,
    shortage,
    exact: BUCKETS.every((bucket) => actual[bucket] === target[bucket]),
    historicalReuseCount: questions.filter((question) => question._historical_reuse).length,
  };
}

export function shouldApplyEnareQuota(examBoard: unknown, difficulty: unknown): boolean {
  const board = String(examBoard ?? "").trim().toLowerCase();
  const mode = String(difficulty ?? "misto").trim().toLowerCase();
  return board === "enare" && ["misto", "prova_real"].includes(mode);
}

export function getCorpusDifficultyPlan(
  examBoard: unknown,
  difficulty: unknown,
): CorpusDifficultyPlan | null {
  const board = String(examBoard ?? "").trim().toLowerCase();
  const mode = String(difficulty ?? "misto").trim().toLowerCase();
  if (!["misto", "prova_real"].includes(mode)) return null;

  const mix = board === "enare"
    ? ENARE_DIFFICULTY_MIX
    : (["geral", "all"].includes(board) ? GENERAL_DIFFICULTY_MIX : null);
  if (!mix) return null;

  return {
    mix,
    scale: "corpus-relative-3-4-5-v1",
    calibrationStatus: "experimental",
  };
}

export function calculateWeightedTopicTargets(total: number, weights: TopicWeight[]): Record<string, number> {
  const safe = weights
    .filter((item) => item.topic?.trim() && Number(item.weight) > 0)
    .map((item, index) => ({ ...item, index, weight: Number(item.weight) }));
  if (safe.length === 0) return {};
  const weightTotal = safe.reduce((sum, item) => sum + item.weight, 0);
  const raw = safe.map((item) => Math.max(0, Math.floor(total)) * item.weight / weightTotal);
  const counts = raw.map(Math.floor);
  let remainder = Math.max(0, Math.floor(total)) - counts.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index++) counts[order[index % order.length].index]++;
  return Object.fromEntries(safe.map((item, index) => [item.topic, counts[index]]));
}

export function selectByTopicAndDifficultyQuota<
  T extends { id?: unknown; difficulty?: unknown; _historical_reuse?: boolean; _topic_bucket?: string },
>(candidates: T[], total: number, mix: DifficultyMix, weights: TopicWeight[]): DifficultyQuotaResult<T> {
  const target = calculateDifficultyTargets(total, mix);
  const topicTarget = calculateWeightedTopicTargets(total, weights);
  const remainingDifficulty = { ...target };
  const selected: T[] = [];

  for (const { topic } of weights) {
    const topicCount = topicTarget[topic] || 0;
    const topicDifficultyTarget = calculateDifficultyTargets(topicCount, remainingDifficulty);
    for (const bucket of BUCKETS) {
      const pool = candidates
        .filter((question) => question._topic_bucket === topic && normalizeEnareCorpusDifficulty(question.difficulty) === bucket)
        .sort((a, b) =>
          Number(Boolean(a._historical_reuse)) - Number(Boolean(b._historical_reuse)) ||
          String(a.id ?? "").localeCompare(String(b.id ?? ""))
        );
      const picked = pool.slice(0, topicDifficultyTarget[bucket]);
      selected.push(...picked);
      remainingDifficulty[bucket] = Math.max(0, remainingDifficulty[bucket] - picked.length);
    }
  }

  const actual = { easy: 0, medium: 0, hard: 0 } satisfies Record<DifficultyBucket, number>;
  const topicActual = Object.fromEntries(Object.keys(topicTarget).map((topic) => [topic, 0]));
  for (const question of selected) {
    const bucket = normalizeEnareCorpusDifficulty(question.difficulty);
    if (bucket !== "unclassified") actual[bucket]++;
    if (question._topic_bucket && question._topic_bucket in topicActual) topicActual[question._topic_bucket]++;
  }
  const shortage = Object.fromEntries(BUCKETS.map((bucket) => [bucket, Math.max(0, target[bucket] - actual[bucket])])) as Record<DifficultyBucket, number>;
  const topicShortage = Object.fromEntries(Object.entries(topicTarget).map(([topic, count]) => [topic, Math.max(0, count - topicActual[topic])]));
  const available = Object.fromEntries(BUCKETS.map((bucket) => [bucket, candidates.filter((question) => normalizeEnareCorpusDifficulty(question.difficulty) === bucket).length])) as Record<DifficultyBucket, number>;

  return {
    questions: selected,
    target,
    actual,
    available,
    shortage,
    exact: selected.length === total && BUCKETS.every((bucket) => actual[bucket] === target[bucket]) && Object.values(topicShortage).every((count) => count === 0),
    historicalReuseCount: selected.filter((question) => question._historical_reuse).length,
    topicTarget,
    topicActual,
    topicShortage,
  };
}
