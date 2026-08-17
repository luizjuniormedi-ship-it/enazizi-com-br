import {
  calculateDifficultyTargets,
  collectPaginatedRows,
  ENAMED_PREPARATORY_FRESHNESS_POLICY,
  ENARE_DIFFICULTY_MIX,
  GENERAL_DIFFICULTY_MIX,
  getCorpusDifficultyPlan,
  normalizeEnareCorpusDifficulty,
  selectByDifficultyQuota,
  selectByTopicAndDifficultyQuota,
  classifyVisibleTopicBucket,
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

Deno.test("Simulado Geral 100 respeita simultaneamente pesos temáticos e 30/50/20", () => {
  const weights = [
    { topic: "Clínica Médica", weight: 20 }, { topic: "Cirurgia", weight: 15 },
    { topic: "Pediatria", weight: 12 }, { topic: "Ginecologia", weight: 12 },
    { topic: "Obstetrícia", weight: 10 }, { topic: "Medicina Preventiva", weight: 8 },
    { topic: "Psiquiatria", weight: 5 }, { topic: "Dermatologia", weight: 4 },
    { topic: "Neurologia", weight: 4 }, { topic: "Ortopedia", weight: 3 },
    { topic: "Oftalmologia", weight: 3 }, { topic: "Otorrinolaringologia", weight: 2 },
    { topic: "Medicina Legal", weight: 2 },
  ];
  const candidates = weights.flatMap(({ topic }) => [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `${topic}-e-${i}`, difficulty: 3, _topic_bucket: topic })),
    ...Array.from({ length: 50 }, (_, i) => ({ id: `${topic}-m-${i}`, difficulty: 4, _topic_bucket: topic })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: `${topic}-h-${i}`, difficulty: 5, _topic_bucket: topic })),
  ]);

  const result = selectByTopicAndDifficultyQuota(candidates, 100, GENERAL_DIFFICULTY_MIX, weights);

  assertEquals(result.questions.length, 100);
  assertEquals(new Set(result.questions.map((question) => question.id)).size, 100);
  assertEquals(result.target, { easy: 30, medium: 50, hard: 20 });
  assertEquals(result.actual, result.target);
  assertEquals(result.topicActual, result.topicTarget);
  assertEquals(result.exact, true);
});

Deno.test("seleção temática prefere corpus fresco mesmo se histórico ordenar primeiro", () => {
  const weights = [{ topic: "Clínica Médica", weight: 100 }];
  const historical = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `a-e-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `a-m-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `a-h-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
  ];
  const fresh = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `z-e-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `z-m-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `z-h-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica" })),
  ];

  const result = selectByTopicAndDifficultyQuota([...historical, ...fresh], 10, GENERAL_DIFFICULTY_MIX, weights);
  assertEquals(result.exact, true);
  assertEquals(result.historicalReuseCount, 0);
});

Deno.test("Preparatório ENAMED aceita no máximo 10 reutilizações recentes para completar 100", () => {
  const weights = [{ topic: "Clínica Médica", weight: 100 }];
  const fresh = [
    ...Array.from({ length: 27 }, (_, i) => ({ id: `fe-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 45 }, (_, i) => ({ id: `fm-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 18 }, (_, i) => ({ id: `fh-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica" })),
  ];
  const recent = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: `re-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `rm-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `rh-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
  ];
  const result = selectByTopicAndDifficultyQuota([...fresh, ...recent], 100, GENERAL_DIFFICULTY_MIX, weights, {
    freshnessPolicy: ENAMED_PREPARATORY_FRESHNESS_POLICY,
  });
  assertEquals(result.questions.length, 100);
  assertEquals(result.historicalReuseCount, 10);
  assertEquals(result.freshnessActual, {
    freshCount: 90, recentReuseCount: 10, withinLimit: true, complete: true, exact: true,
    blockedByReuseLimit: 0, minimumRecentReuse: 10, structuralShortage: 0, blockedByCap: false,
  });
  assertEquals(result.exact, true);
});

Deno.test("Preparatório ENAMED falha fechado quando a centésima questão exigiria a 11ª reutilização", () => {
  const weights = [{ topic: "Clínica Médica", weight: 100 }];
  const fresh = [
    ...Array.from({ length: 26 }, (_, i) => ({ id: `fe-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 45 }, (_, i) => ({ id: `fm-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica" })),
    ...Array.from({ length: 18 }, (_, i) => ({ id: `fh-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica" })),
  ];
  const recent = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `re-${i}`, difficulty: 3, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `rm-${i}`, difficulty: 4, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `rh-${i}`, difficulty: 5, _topic_bucket: "Clínica Médica", _historical_reuse: true })),
  ];
  const result = selectByTopicAndDifficultyQuota([...fresh, ...recent], 100, GENERAL_DIFFICULTY_MIX, weights, {
    freshnessPolicy: ENAMED_PREPARATORY_FRESHNESS_POLICY,
  });
  assertEquals(result.questions.length, 99);
  assertEquals(result.historicalReuseCount, 10);
  assertEquals(result.freshnessActual?.blockedByReuseLimit, 1);
  assertEquals(result.freshnessActual?.minimumRecentReuse, 11);
  assertEquals(result.freshnessActual?.blockedByCap, true);
  assertEquals(result.exact, false);
});

Deno.test("histórico recente é paginado além de 500 IDs sem truncamento", async () => {
  const source = Array.from({ length: 711 }, (_, index) => ({ question_id: `q-${index}` }));
  const calls: Array<[number, number]> = [];
  const rows = await collectPaginatedRows(async (from, to) => {
    calls.push([from, to]);
    return source.slice(from, to + 1);
  }, 500);
  assertEquals(rows.length, 711);
  assertEquals(new Set(rows.map((row) => row.question_id)).size, 711);
  assertEquals(calls, [[0, 499], [500, 999]]);
});

Deno.test("classificação temática usa o tema visível e a hierarquia explícita do blueprint", () => {
  const weights = [
    { topic: "Clínica Médica", weight: 20, subtopics: [{ name: "Cardiologia" }] },
    { topic: "Pediatria", weight: 12 },
    { topic: "Cirurgia", weight: 15 },
  ];

  assertEquals(classifyVisibleTopicBucket({ topic: "Cardiologia" }, weights), {
    bucket: "Clínica Médica",
    visibleTopic: "Cardiologia",
  });
  assertEquals(classifyVisibleTopicBucket({ topic: "Pediatria" }, weights), {
    bucket: "Pediatria",
    visibleTopic: "Pediatria",
  });
  assertEquals(classifyVisibleTopicBucket({ topic: "Cirurgia Geral" }, weights), {
    bucket: "Cirurgia",
    visibleTopic: "Cirurgia Geral",
  });
  assertEquals(classifyVisibleTopicBucket({ topic: "Anestesiologia" }, weights), null);
});

Deno.test("corpus adversarial com 76 Pediatria nunca produz falsa distribuição exata", () => {
  const weights = [
    { topic: "Clínica Médica", weight: 20 },
    { topic: "Cirurgia", weight: 15 },
    { topic: "Pediatria", weight: 12 },
    { topic: "Ginecologia e Obstetrícia", weight: 12 },
    { topic: "Medicina Preventiva", weight: 10 },
    { topic: "Medicina de Emergência", weight: 8 },
    { topic: "Terapia Intensiva", weight: 5 },
    { topic: "Ortopedia", weight: 4 },
    { topic: "Oncologia", weight: 4 },
    { topic: "Angiologia", weight: 3 },
    { topic: "Urologia", weight: 3 },
    { topic: "Oftalmologia", weight: 2 },
    { topic: "Otorrinolaringologia", weight: 2 },
  ];
  const pediatrics = [
    ...Array.from({ length: 23 }, (_, i) => ({ id: `p-e-${i}`, difficulty: 3, _topic_bucket: "Pediatria", _requested_topic: "Clínica Médica" })),
    ...Array.from({ length: 38 }, (_, i) => ({ id: `p-m-${i}`, difficulty: 4, _topic_bucket: "Pediatria", _requested_topic: "Cirurgia" })),
    ...Array.from({ length: 15 }, (_, i) => ({ id: `p-h-${i}`, difficulty: 5, _topic_bucket: "Pediatria", _requested_topic: "Ginecologia e Obstetrícia" })),
  ];

  const result = selectByTopicAndDifficultyQuota(pediatrics, 100, GENERAL_DIFFICULTY_MIX, weights);

  assertEquals(result.topicActual?.Pediatria, 12);
  assertEquals(result.questions.length, 12);
  assertEquals(result.exact, false);
  assertEquals(Object.values(result.topicShortage || {}).reduce((sum, count) => sum + count, 0), 88);
});
