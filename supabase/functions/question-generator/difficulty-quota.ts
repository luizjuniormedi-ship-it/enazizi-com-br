export type DifficultyBucket = "easy" | "medium" | "hard";

export type DifficultyMix = Record<DifficultyBucket, number>;

export interface DifficultyQuotaResult<T> {
  questions: T[];
  target: Record<DifficultyBucket, number>;
  actual: Record<DifficultyBucket, number>;
  available: Record<DifficultyBucket, number>;
  shortage: Record<DifficultyBucket, number>;
  exact: boolean;
}

export const ENARE_DIFFICULTY_MIX: DifficultyMix = {
  easy: 25,
  medium: 50,
  hard: 25,
};

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

export function selectByDifficultyQuota<T extends { id?: unknown; difficulty?: unknown }>(
  candidates: T[],
  total: number,
  mix: DifficultyMix,
): DifficultyQuotaResult<T> {
  const target = calculateDifficultyTargets(total, mix);
  const indexed = candidates
    .map((question, index) => ({ question, index, bucket: normalizeEnareCorpusDifficulty(question.difficulty) }))
    .sort((a, b) => String(a.question.id ?? a.index).localeCompare(String(b.question.id ?? b.index)));
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
  };
}

export function shouldApplyEnareQuota(examBoard: unknown, difficulty: unknown): boolean {
  const board = String(examBoard ?? "").trim().toLowerCase();
  const mode = String(difficulty ?? "misto").trim().toLowerCase();
  return board === "enare" && ["misto", "prova_real"].includes(mode);
}
