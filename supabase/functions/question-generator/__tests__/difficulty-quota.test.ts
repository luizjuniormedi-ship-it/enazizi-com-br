import {
  calculateDifficultyTargets,
  ENARE_DIFFICULTY_MIX,
  GENERAL_DIFFICULTY_MIX,
  getCorpusDifficultyPlan,
  normalizeEnareCorpusDifficulty,
  selectByDifficultyQuota,
  shouldApplyEnareQuota,
} from "../difficulty-quota.ts";

const assertEquals = (actual: unknown, expected: unknown, message?: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message || "assertEquals"}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  }
};

Deno.test("ENARE 100 aplica exatamente 25/50/25", () => {
  const candidates = [
    ...Array.from({ length: 101 }, (_, i) => ({ id: `e-${i.toString().padStart(3, "0")}`, difficulty: 3 })),
    ...Array.from({ length: 415 }, (_, i) => ({ id: `m-${i.toString().padStart(3, "0")}`, difficulty: 4 })),
    ...Array.from({ length: 51 }, (_, i) => ({ id: `h-${i.toString().padStart(3, "0")}`, difficulty: 5 })),
  ];

  const result = selectByDifficultyQuota(candidates, 100, ENARE_DIFFICULTY_MIX);

  assertEquals(result.target, { easy: 25, medium: 50, hard: 25 });
  assertEquals(result.actual, result.target);
  assertEquals(result.questions.length, 100);
  assertEquals(new Set(result.questions.map((question) => question.id)).size, 100);
  assertEquals(result.exact, true);
});

Deno.test("exclusões históricas aplicadas antes da cota não reaparecem", () => {
  const excluded = new Set(["e-0", "m-0", "h-0"]);
  const candidates = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `e-${i}`, difficulty: 3 })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `m-${i}`, difficulty: 4 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `h-${i}`, difficulty: 5 })),
  ].filter((question) => !excluded.has(question.id));

  const result = selectByDifficultyQuota(candidates, 8, ENARE_DIFFICULTY_MIX);

  assertEquals(result.target, { easy: 2, medium: 4, hard: 2 });
  assertEquals(result.questions.some((question) => excluded.has(question.id)), false);
  assertEquals(result.exact, true);
});

Deno.test("falta de difícil retorna parcial sem redistribuição silenciosa", () => {
  const candidates = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `e-${i}`, difficulty: 3 })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `m-${i}`, difficulty: 4 })),
  ];

  const result = selectByDifficultyQuota(candidates, 8, ENARE_DIFFICULTY_MIX);

  assertEquals(result.questions.length, 6);
  assertEquals(result.target, { easy: 2, medium: 4, hard: 2 });
  assertEquals(result.actual, { easy: 2, medium: 4, hard: 0 });
  assertEquals(result.shortage, { easy: 0, medium: 0, hard: 2 });
  assertEquals(result.exact, false);
});

Deno.test("normalização do corpus ENARE é explícita para a escala legada 3/4/5", () => {
  assertEquals([3, 4, 5].map(normalizeEnareCorpusDifficulty), ["easy", "medium", "hard"]);
  assertEquals([1, 2, "fácil", "medium", "difícil"].map(normalizeEnareCorpusDifficulty), [
    "unclassified",
    "unclassified",
    "unclassified",
    "unclassified",
    "unclassified",
  ]);
  assertEquals(normalizeEnareCorpusDifficulty("legado-desconhecido"), "unclassified");
  assertEquals(calculateDifficultyTargets(5, ENARE_DIFFICULTY_MIX), { easy: 1, medium: 3, hard: 1 });
});

Deno.test("fluxo real prova_real ativa a cota ENARE sem aceitar banca manipulada", () => {
  assertEquals(shouldApplyEnareQuota("ENARE", "prova_real"), true);
  assertEquals(shouldApplyEnareQuota("enare", "misto"), true);
  assertEquals(shouldApplyEnareQuota("FGV", "prova_real"), false);
  assertEquals(shouldApplyEnareQuota("ENARE", "dificil"), false);
});

Deno.test("Simulado Geral 100 aplica 30/50/20 sem alegar calibração oficial", () => {
  const candidates = [
    ...Array.from({ length: 60 }, (_, i) => ({ id: `ge-${i}`, difficulty: 3 })),
    ...Array.from({ length: 100 }, (_, i) => ({ id: `gm-${i}`, difficulty: 4 })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: `gh-${i}`, difficulty: 5 })),
  ];
  const plan = getCorpusDifficultyPlan("GERAL", "misto");
  if (!plan) throw new Error("plano geral ausente");
  const result = selectByDifficultyQuota(candidates, 100, plan.mix);

  assertEquals(GENERAL_DIFFICULTY_MIX, { easy: 30, medium: 50, hard: 20 });
  assertEquals(result.target, { easy: 30, medium: 50, hard: 20 });
  assertEquals(result.actual, result.target);
  assertEquals(result.questions.length, 100);
  assertEquals(new Set(result.questions.map((question) => question.id)).size, 100);
  assertEquals(plan.calibrationStatus, "experimental");
  assertEquals(plan.scale, "corpus-relative-3-4-5-v1");
});
