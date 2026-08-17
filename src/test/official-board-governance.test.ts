import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXAM_PROFILES, getOfficialBoardBlockReason } from "@/lib/realExamDistribution";
import { getOfficialBoardAvailability } from "../../supabase/functions/_shared/banca-profiles";
import {
  classifyVisibleTopicBucket,
  getCorpusDifficultyPlan,
  selectByDifficultyQuota,
  selectByTopicAndDifficultyQuota,
} from "../../supabase/functions/question-generator/difficulty-quota";

const questionGeneratorSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/question-generator/index.ts"),
  "utf8",
);

describe("official board governance", () => {
  it("keeps the ENAMED preparatory freshness contract fail-closed", () => {
    expect(questionGeneratorSource).toContain('"FRESHNESS_SHORTAGE"');
    expect(questionGeneratorSource).toContain("ENAMED_PREPARATORY_FRESHNESS_POLICY");
    expect(questionGeneratorSource).not.toContain(".filter(Boolean))).slice(0, 500)");
  });
  it("persists and returns the same reconciled simulation source", () => {
    expect(questionGeneratorSource).toContain("const sessionSource = persistedSources.size > 1");
    expect(questionGeneratorSource).toContain("source: sessionSource,");
    expect(questionGeneratorSource.match(/source: sessionSource,/g)).toHaveLength(2);
    expect(questionGeneratorSource).not.toContain('source: body.mode === "ai_generation" ? "ai" : "bank"');
  });
  it("rejects a partial ENAMED preparatory blueprint", async () => {
    const { isCanonicalGeneralBlueprint } = await import("../../supabase/functions/question-generator/difficulty-quota");
    expect(isCanonicalGeneralBlueprint(EXAM_PROFILES.GERAL.topicWeights)).toBe(true);
    expect(isCanonicalGeneralBlueprint(EXAM_PROFILES.GERAL.topicWeights.slice(0, 12))).toBe(false);
    expect(isCanonicalGeneralBlueprint(EXAM_PROFILES.GERAL.topicWeights.map((item, index) =>
      index === 0 ? { ...item, weight: 19 } : item))).toBe(false);
  });
  it("blocks every official board until its runtime is homologated", () => {
    const officialProfiles = Object.entries(EXAM_PROFILES).filter(([key]) => key !== "GERAL");
    const enabled = officialProfiles.filter(([, profile]) => profile.canGenerate);

    expect(enabled.map(([key]) => key)).toEqual([]);
    expect(EXAM_PROFILES.ENARE.availability).toBe("suspended");
    expect(getOfficialBoardAvailability("ENARE")).toMatchObject({
      status: "suspended",
      canGenerateOfficialExam: false,
    });
  });

  it.each(["USP-SP", "CEBRASPE", "FGV", "FCC", "ENAMED"])(
    "blocks %s consistently in frontend and generator",
    (board) => {
      expect(EXAM_PROFILES[board].canGenerate).toBe(false);
      expect(getOfficialBoardAvailability(board)?.canGenerateOfficialExam).toBe(false);
    },
  );

  it("treats GERAL as a non-official simulation", () => {
    expect(EXAM_PROFILES.GERAL.name).toBe("Preparatório ENAMED");
    expect(EXAM_PROFILES.GERAL.availability).toBe("general");
    expect(EXAM_PROFILES.GERAL.availabilityMessage).toContain("dificuldade experimental");
    expect(EXAM_PROFILES.ENAMED.canGenerate).toBe(false);
    expect(getOfficialBoardAvailability("GERAL")).toBeNull();
  });

  it("submits the ENAMED preparatory blueprint through the canonical General entry point", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/Simulados.tsx"),
      "utf8",
    );

    expect(source).toContain("topicWeights: EXAM_PROFILES.GERAL.topicWeights");
    expect(source).toContain('realExamProfile: "GERAL"');
    expect(source).not.toContain('realExamProfile: "ENAMED"');
    expect(source).not.toContain("supabase.auth.getSession()");
    expect(source).toContain("AUTH_SESSION_UNAVAILABLE");
  });

  it("exposes difficulty and generation timing for browser audit", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/simulados/SimuladoExam.tsx"),
      "utf8",
    );

    expect(source).toContain('data-testid="simulation-generation-audit"');
    expect(source).toContain("data-generation-server-duration-ms");
    expect(source).toContain('data-testid="question-difficulty"');
    expect(source).toContain("Dificuldade experimental:");
  });

  it("fails closed for unknown official boards", () => {
    expect(getOfficialBoardAvailability("BANCA_DESCONHECIDA")).toMatchObject({
      status: "draft",
      canGenerateOfficialExam: false,
    });
  });

  it("blocks suspended boards from every real-exam entry point", () => {
    expect(getOfficialBoardBlockReason("ENARE", "prova_real")).toContain("suspenso");
    expect(getOfficialBoardBlockReason("USP-SP", "tri")).toContain("insuficiente");
    expect(getOfficialBoardBlockReason("BANCA_DESCONHECIDA", "prova_real")).toContain("homologados");
  });

  it("keeps general and non-official study modes available", () => {
    expect(getOfficialBoardBlockReason("GERAL", "prova_real")).toBeNull();
    expect(getOfficialBoardBlockReason("ENARE", "estudo")).toBeNull();
  });

  it("keeps the General 100-question difficulty contract identical in UI and generator", () => {
    const plan = getCorpusDifficultyPlan("GERAL", "misto");
    expect(plan?.mix).toEqual(EXAM_PROFILES.GERAL.difficultyMix);

    const candidates = [
      ...Array.from({ length: 60 }, (_, index) => ({ id: `easy-${index}`, difficulty: 3 })),
      ...Array.from({ length: 100 }, (_, index) => ({ id: `medium-${index}`, difficulty: 4 })),
      ...Array.from({ length: 40 }, (_, index) => ({ id: `hard-${index}`, difficulty: 5 })),
    ];
    const result = selectByDifficultyQuota(candidates, 100, plan!.mix);

    expect(result.target).toEqual({ easy: 30, medium: 50, hard: 20 });
    expect(result.actual).toEqual(result.target);
    expect(result.questions).toHaveLength(100);
    expect(new Set(result.questions.map((question) => question.id)).size).toBe(100);
    expect(result.historicalReuseCount).toBe(0);
    expect(plan?.calibrationStatus).toBe("experimental");
  });

  it("fills a 100-question quota with historical items only after fresh items", () => {
    const plan = getCorpusDifficultyPlan("GERAL", "misto")!;
    const candidates = [
      ...Array.from({ length: 30 }, (_, index) => ({ id: `e-${index}`, difficulty: 3, _historical_reuse: index >= 25 })),
      ...Array.from({ length: 50 }, (_, index) => ({ id: `m-${index}`, difficulty: 4, _historical_reuse: index >= 45 })),
      ...Array.from({ length: 20 }, (_, index) => ({ id: `h-${index}`, difficulty: 5, _historical_reuse: index >= 15 })),
    ];
    const result = selectByDifficultyQuota(candidates, 100, plan.mix);

    expect(result.exact).toBe(true);
    expect(result.questions).toHaveLength(100);
    expect(result.historicalReuseCount).toBe(15);
  });

  it("classifies the visible corpus topic through the explicit General blueprint", () => {
    expect(classifyVisibleTopicBucket(
      { topic: "Cardiologia" },
      EXAM_PROFILES.GERAL.topicWeights,
    )).toEqual({ bucket: "Clínica Médica", visibleTopic: "Cardiologia" });
    expect(classifyVisibleTopicBucket(
      { topic: "Pediatria" },
      EXAM_PROFILES.GERAL.topicWeights,
    )).toEqual({ bucket: "Pediatria", visibleTopic: "Pediatria" });
  });

  it("does not report exact when 76 of 100 candidates are visibly Pediatrics", () => {
    const candidates = [
      ...Array.from({ length: 23 }, (_, index) => ({ id: `p-e-${index}`, difficulty: 3, _topic_bucket: "Pediatria" })),
      ...Array.from({ length: 38 }, (_, index) => ({ id: `p-m-${index}`, difficulty: 4, _topic_bucket: "Pediatria" })),
      ...Array.from({ length: 15 }, (_, index) => ({ id: `p-h-${index}`, difficulty: 5, _topic_bucket: "Pediatria" })),
    ];

    const result = selectByTopicAndDifficultyQuota(
      candidates,
      100,
      EXAM_PROFILES.GERAL.difficultyMix,
      EXAM_PROFILES.GERAL.topicWeights,
    );

    expect(result.questions).toHaveLength(12);
    expect(result.topicActual?.Pediatria).toBe(12);
    expect(result.exact).toBe(false);
    expect(Object.values(result.topicShortage || {}).reduce((sum, count) => sum + count, 0)).toBe(88);
  });

  it("keeps global difficulty exact when a specialty has no hard questions", () => {
    const weights = [
      { topic: "Clínica Médica", weight: 50 },
      { topic: "Terapia Intensiva", weight: 50 },
    ];
    const candidates = [
      ...Array.from({ length: 30 }, (_, index) => ({ id: `c-e-${index}`, difficulty: 3, _topic_bucket: "Clínica Médica" })),
      ...Array.from({ length: 50 }, (_, index) => ({ id: `c-m-${index}`, difficulty: 4, _topic_bucket: "Clínica Médica" })),
      ...Array.from({ length: 20 }, (_, index) => ({ id: `c-h-${index}`, difficulty: 5, _topic_bucket: "Clínica Médica" })),
      ...Array.from({ length: 50 }, (_, index) => ({ id: `t-e-${index}`, difficulty: 3, _topic_bucket: "Terapia Intensiva" })),
      ...Array.from({ length: 50 }, (_, index) => ({ id: `t-m-${index}`, difficulty: 4, _topic_bucket: "Terapia Intensiva" })),
    ];

    const result = selectByTopicAndDifficultyQuota(candidates, 100, { easy: 30, medium: 50, hard: 20 }, weights);

    expect(result.exact).toBe(true);
    expect(result.actual).toEqual({ easy: 30, medium: 50, hard: 20 });
    expect(result.topicActual).toEqual({ "Clínica Médica": 50, "Terapia Intensiva": 50 });
    expect(result.questions).toHaveLength(100);
  });
});
