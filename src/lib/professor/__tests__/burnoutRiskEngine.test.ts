import { describe, it, expect } from "vitest";
import { computeBurnoutRisk, type BurnoutInputs } from "../burnoutRiskEngine";

const base = (over: Partial<BurnoutInputs> = {}): BurnoutInputs => ({
  avg_lapses: 0,
  retention_score: 90,
  inactive_days: 0,
  streak: 5,
  completion_rate: 80,
  overload_score: 10,
  accuracy_recent: 80,
  accuracy_prev: 80,
  ...over,
});

describe("computeBurnoutRisk", () => {
  describe("insufficient data", () => {
    it("returns low with 'dados insuficientes' when lapses, retention and accuracy_recent are null", () => {
      const r = computeBurnoutRisk({
        ...base(),
        avg_lapses: null,
        retention_score: null,
        accuracy_recent: null,
      });
      expect(r.level).toBe("low");
      expect(r.score).toBe(0);
      expect(r.signals).toContain("dados insuficientes");
      expect(r.recommendation).toBe("maintain");
    });

    it("proceeds when at least one signal is present (accuracy_recent only)", () => {
      const r = computeBurnoutRisk({
        ...base(),
        avg_lapses: null,
        retention_score: null,
        accuracy_recent: 50,
        accuracy_prev: 80,
      });
      expect(r.signals).not.toContain("dados insuficientes");
      expect(r.signals).toContain("queda de acurácia recente");
    });
  });

  describe("happy path", () => {
    it("returns low + maintain for a healthy student", () => {
      const r = computeBurnoutRisk(base());
      expect(r.level).toBe("low");
      expect(r.score).toBe(0);
      expect(r.recommendation).toBe("maintain");
      expect(r.signals).toEqual([]);
    });
  });

  describe("individual signals", () => {
    it("adds 25 for high lapses (>=3)", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 3 }));
      expect(r.score).toBe(25);
      expect(r.signals).toContain("lapses elevados");
    });

    it("does NOT add for lapses = 2.9", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 2.9 }));
      expect(r.signals).not.toContain("lapses elevados");
    });

    it("adds 25 for retention < 65", () => {
      const r = computeBurnoutRisk(base({ retention_score: 64 }));
      expect(r.score).toBe(25);
      expect(r.signals).toContain("retenção baixa");
    });

    it("does NOT add for retention = 65", () => {
      const r = computeBurnoutRisk(base({ retention_score: 65 }));
      expect(r.signals).not.toContain("retenção baixa");
    });

    it("treats null retention as 100 (no signal)", () => {
      const r = computeBurnoutRisk(base({ retention_score: null }));
      expect(r.signals).not.toContain("retenção baixa");
    });

    it("adds 20 for overload_score > 30", () => {
      const r = computeBurnoutRisk(base({ overload_score: 31 }));
      expect(r.score).toBe(20);
      expect(r.signals).toContain("carga acima do saudável");
    });

    it("does NOT add for overload_score = 30", () => {
      const r = computeBurnoutRisk(base({ overload_score: 30 }));
      expect(r.signals).not.toContain("carga acima do saudável");
    });

    it("adds 20 for accuracy drop > 10 points", () => {
      const r = computeBurnoutRisk(base({ accuracy_recent: 60, accuracy_prev: 75 }));
      expect(r.signals).toContain("queda de acurácia recente");
    });

    it("does NOT add for accuracy drop of exactly 10", () => {
      const r = computeBurnoutRisk(base({ accuracy_recent: 70, accuracy_prev: 80 }));
      expect(r.signals).not.toContain("queda de acurácia recente");
    });

    it("requires both accuracy fields to be non-null", () => {
      const r = computeBurnoutRisk(base({ accuracy_recent: 40, accuracy_prev: null }));
      expect(r.signals).not.toContain("queda de acurácia recente");
    });
  });

  describe("levels and recommendations", () => {
    it("moderate at score >= 25 → reduce_load", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 3 }));
      expect(r.level).toBe("moderate");
      expect(r.recommendation).toBe("reduce_load");
    });

    it("high at score >= 50 → recovery_mode", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 3, retention_score: 60 }));
      expect(r.level).toBe("high");
      expect(r.recommendation).toBe("recovery_mode");
    });

    it("caps score at 100", () => {
      const r = computeBurnoutRisk({
        avg_lapses: 5,
        retention_score: 40,
        inactive_days: 3,
        streak: 0,
        completion_rate: 20,
        overload_score: 90,
        accuracy_recent: 30,
        accuracy_prev: 80,
      });
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.score).toBe(90);
    });
  });

  describe("inactivity edge case", () => {
    it("inactive_days >= 14 short-circuits to low + mentoria (abandono)", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 5, retention_score: 40, inactive_days: 14 }));
      expect(r.level).toBe("low");
      expect(r.recommendation).toBe("mentoria");
      expect(r.signals.some((s) => s.includes("inatividade prolongada"))).toBe(true);
    });

    it("inactive_days = 13 does NOT trigger abandono branch", () => {
      const r = computeBurnoutRisk(base({ avg_lapses: 3, inactive_days: 13 }));
      expect(r.recommendation).not.toBe("mentoria");
    });
  });
});
