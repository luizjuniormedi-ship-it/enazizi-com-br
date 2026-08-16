import { describe, expect, it } from "vitest";
import { EXAM_PROFILES, getOfficialBoardBlockReason } from "@/lib/realExamDistribution";
import { getOfficialBoardAvailability } from "../../supabase/functions/_shared/banca-profiles";
import {
  getCorpusDifficultyPlan,
  selectByDifficultyQuota,
} from "../../supabase/functions/question-generator/difficulty-quota";

describe("official board governance", () => {
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
    expect(EXAM_PROFILES.GERAL.name).toBe("Simulado Geral");
    expect(EXAM_PROFILES.GERAL.availability).toBe("general");
    expect(getOfficialBoardAvailability("GERAL")).toBeNull();
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
});
