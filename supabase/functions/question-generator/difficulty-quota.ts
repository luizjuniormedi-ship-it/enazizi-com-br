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
  freshnessPolicy?: FreshnessPolicy;
  freshnessActual?: FreshnessActual;
  topicTarget?: Record<string, number>;
  topicActual?: Record<string, number>;
  topicShortage?: Record<string, number>;
}

export interface FreshnessPolicy {
  recentWindowDays: number;
  maxRecentReuse: number;
  strategy: "min-cost-topic-difficulty-v1";
}

export interface FreshnessActual {
  freshCount: number;
  recentReuseCount: number;
  withinLimit: boolean;
  complete: boolean;
  exact: boolean;
  blockedByReuseLimit: number;
  minimumRecentReuse: number;
  structuralShortage: number;
  blockedByCap: boolean;
}

export interface QuotaSelectionOptions {
  freshnessPolicy?: FreshnessPolicy;
}

export const ENAMED_PREPARATORY_FRESHNESS_POLICY: FreshnessPolicy = {
  recentWindowDays: 7,
  maxRecentReuse: 10,
  strategy: "min-cost-topic-difficulty-v1",
};

export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0;; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
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

export function getAcceptedVisibleTopicLabels(weight: TopicWeight): string[] {
  return Array.from(new Set([
    weight.topic,
    ...(weight.subtopics || []).map((subtopic) => subtopic.name),
    ...(VISIBLE_TOPIC_EQUIVALENTS[weight.topic] || []),
  ].filter(Boolean)));
}

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
    const acceptedLabels = getAcceptedVisibleTopicLabels(weight).map(normalizeTopicLabel);
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

export const GENERAL_TOPIC_WEIGHTS: Readonly<Record<string, number>> = {
  "Clínica Médica": 20, "Cirurgia": 15, "Pediatria": 12,
  "Ginecologia e Obstetrícia": 12, "Medicina Preventiva": 10,
  "Medicina de Emergência": 8, "Terapia Intensiva": 5, "Ortopedia": 4,
  "Oncologia": 4, "Angiologia": 3, "Urologia": 3, "Oftalmologia": 2,
  "Otorrinolaringologia": 2,
};

export function isCanonicalGeneralBlueprint(weights: TopicWeight[]): boolean {
  if (weights.length !== Object.keys(GENERAL_TOPIC_WEIGHTS).length) return false;
  const seen = new Set<string>();
  for (const item of weights) {
    if (seen.has(item.topic) || GENERAL_TOPIC_WEIGHTS[item.topic] !== Number(item.weight)) return false;
    seen.add(item.topic);
  }
  return Object.keys(GENERAL_TOPIC_WEIGHTS).every((topic) => seen.has(topic));
}

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
  options: QuotaSelectionOptions = {},
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

  let remainingReuse = options.freshnessPolicy?.maxRecentReuse ?? Number.POSITIVE_INFINITY;
  for (const bucket of BUCKETS) {
    const fresh = queues[bucket].filter((item) => !item.question._historical_reuse).slice(0, target[bucket]);
    const missing = target[bucket] - fresh.length;
    const historical = queues[bucket]
      .filter((item) => item.question._historical_reuse)
      .slice(0, Math.min(missing, remainingReuse));
    selected.push(...fresh, ...historical);
    remainingReuse -= historical.length;
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

  const historicalReuseCount = questions.filter((question) => question._historical_reuse).length;
  const blockedByReuseLimit = options.freshnessPolicy
    ? Math.max(0, BUCKETS.reduce((sum, bucket) => sum + shortage[bucket], 0) -
      BUCKETS.reduce((sum, bucket) => sum + Math.max(0, target[bucket] - available[bucket]), 0))
    : 0;
  return {
    questions,
    target,
    actual,
    available,
    shortage,
    exact: BUCKETS.every((bucket) => actual[bucket] === target[bucket]),
    historicalReuseCount,
    freshnessPolicy: options.freshnessPolicy,
    freshnessActual: options.freshnessPolicy ? {
      freshCount: questions.length - historicalReuseCount,
      recentReuseCount: historicalReuseCount,
      withinLimit: historicalReuseCount <= options.freshnessPolicy.maxRecentReuse,
      complete: questions.length === Math.max(0, Math.floor(total)),
      exact: BUCKETS.every((bucket) => actual[bucket] === target[bucket]),
      blockedByReuseLimit,
      minimumRecentReuse: historicalReuseCount + blockedByReuseLimit,
      structuralShortage: Math.max(0, total - questions.length - blockedByReuseLimit),
      blockedByCap: blockedByReuseLimit > 0,
    } : undefined,
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
>(candidates: T[], total: number, mix: DifficultyMix, weights: TopicWeight[], options: QuotaSelectionOptions = {}): DifficultyQuotaResult<T> {
  const target = calculateDifficultyTargets(total, mix);
  const topicTarget = calculateWeightedTopicTargets(total, weights);
  const topics = weights.map(({ topic }) => topic).filter((topic) => (topicTarget[topic] || 0) > 0);
  const pools = new Map<string, T[]>();
  for (const topic of topics) {
    for (const bucket of BUCKETS) {
      pools.set(`${topic}\u0000${bucket}`, candidates
        .filter((question) => question._topic_bucket === topic && normalizeEnareCorpusDifficulty(question.difficulty) === bucket)
        .sort((a, b) =>
          Number(Boolean(a._historical_reuse)) - Number(Boolean(b._historical_reuse)) ||
          String(a.id ?? "").localeCompare(String(b.id ?? ""))
        ));
    }
  }

  type Edge = { to: number; rev: number; capacity: number; cost: number; original: number };
  const source = 0;
  const topicOffset = 1;
  const bucketOffset = topicOffset + topics.length;
  const sink = bucketOffset + BUCKETS.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const addEdge = (from: number, to: number, capacity: number, cost: number) => {
    const forward: Edge = { to, rev: graph[to].length, capacity, cost, original: capacity };
    const reverse: Edge = { to: from, rev: graph[from].length, capacity: 0, cost: -cost, original: 0 };
    graph[from].push(forward);
    graph[to].push(reverse);
    return forward;
  };
  const cellEdges = new Map<string, { fresh: Edge; recent: Edge }>();
  topics.forEach((topic, topicIndex) => {
    addEdge(source, topicOffset + topicIndex, topicTarget[topic] || 0, 0);
    BUCKETS.forEach((bucket, bucketIndex) => {
      const cell = pools.get(`${topic}\u0000${bucket}`) || [];
      cellEdges.set(`${topic}\u0000${bucket}`, {
        fresh: addEdge(topicOffset + topicIndex, bucketOffset + bucketIndex, cell.filter((q) => !q._historical_reuse).length, 0),
        recent: addEdge(topicOffset + topicIndex, bucketOffset + bucketIndex, cell.filter((q) => q._historical_reuse).length, 1),
      });
    });
  });
  BUCKETS.forEach((bucket, bucketIndex) => addEdge(bucketOffset + bucketIndex, sink, target[bucket], 0));

  const maxRecentReuse = options.freshnessPolicy?.maxRecentReuse ?? total;
  let flow = 0;
  let recentFlow = 0;
  while (flow < total) {
    const distance = Array<number>(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array<number>(graph.length).fill(-1);
    const previousEdge = Array<number>(graph.length).fill(-1);
    distance[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false;
      for (let from = 0; from < graph.length; from++) graph[from].forEach((edge, edgeIndex) => {
        if (edge.capacity > 0 && distance[from] + edge.cost < distance[edge.to]) {
          distance[edge.to] = distance[from] + edge.cost;
          previousNode[edge.to] = from;
          previousEdge[edge.to] = edgeIndex;
          changed = true;
        }
      });
      if (!changed) break;
    }
    if (previousNode[sink] === -1) break;
    let amount = total - flow;
    for (let node = sink; node !== source; node = previousNode[node]) {
      amount = Math.min(amount, graph[previousNode[node]][previousEdge[node]].capacity);
    }
    const recentCost = Math.max(0, distance[sink]);
    if (recentCost > 0) amount = Math.min(amount, maxRecentReuse - recentFlow);
    if (amount <= 0) break;
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= amount;
      graph[node][edge.rev].capacity += amount;
    }
    flow += amount;
    recentFlow += amount * distance[sink];
  }

  const freshSelected: T[] = [];
  const historicalSelected: T[] = [];
  topics.forEach((topic) => BUCKETS.forEach((bucket) => {
    const cell = pools.get(`${topic}\u0000${bucket}`) || [];
    const edges = cellEdges.get(`${topic}\u0000${bucket}`)!;
    freshSelected.push(...cell.filter((q) => !q._historical_reuse).slice(0, edges.fresh.original - edges.fresh.capacity));
    historicalSelected.push(...cell.filter((q) => q._historical_reuse).slice(0, edges.recent.original - edges.recent.capacity));
  }));
  const selected = [...freshSelected, ...historicalSelected];
  const blockedByReuseLimit = options.freshnessPolicy && selected.length < total && recentFlow >= maxRecentReuse
    ? total - selected.length
    : 0;

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

  const historicalReuseCount = historicalSelected.length;
  const structuralShortage = Math.max(0, total - selected.length - blockedByReuseLimit);
  const selectedIds = selected.map((question) => question.id).filter((id) => id != null);
  const hasUniqueIds = new Set(selectedIds).size === selectedIds.length;
  return {
    questions: selected,
    target,
    actual,
    available,
    shortage,
    exact: selected.length === total && hasUniqueIds && BUCKETS.every((bucket) => actual[bucket] === target[bucket]) && Object.values(topicShortage).every((count) => count === 0),
    historicalReuseCount,
    freshnessPolicy: options.freshnessPolicy,
    freshnessActual: options.freshnessPolicy ? {
      freshCount: freshSelected.length,
      recentReuseCount: historicalReuseCount,
      withinLimit: historicalReuseCount <= options.freshnessPolicy.maxRecentReuse,
      complete: selected.length === total,
      exact: selected.length === total && hasUniqueIds && BUCKETS.every((bucket) => actual[bucket] === target[bucket]) && Object.values(topicShortage).every((count) => count === 0),
      blockedByReuseLimit,
      minimumRecentReuse: historicalReuseCount + blockedByReuseLimit,
      structuralShortage,
      blockedByCap: blockedByReuseLimit > 0,
    } : undefined,
    topicTarget,
    topicActual,
    topicShortage,
  };
}
