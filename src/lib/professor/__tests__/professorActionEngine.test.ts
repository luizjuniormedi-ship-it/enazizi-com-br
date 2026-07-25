import { describe, it, expect } from "vitest";
import {
  computeProfessorAction,
  type StudentCognitiveRisk,
} from "../professorActionEngine";

const baseRisk = (over: Partial<StudentCognitiveRisk> = {}): StudentCognitiveRisk => ({
  user_id: "u-1",
  display_name: "Aluno Teste",
  risk_score: 20,
  risk_level: "low",
  burnout_risk: "low",
  overload_score: 10,
  avg_stability: 0.8,
  avg_lapses: 0,
  retention_score: 90,
  theta_proxy: 0,
  inactive_days: 0,
  ignored_reviews: 0,
  weak_specialty: null,
  suggested_action: "monitorar",
  justification: "ok",
  ...over,
});

describe("computeProfessorAction", () => {
  it("returns monitor for a healthy student", () => {
    const a = computeProfessorAction(baseRisk());
    expect(a.action_type).toBe("monitor");
    expect(a.severity).toBe("low");
    expect(a.id).toBe("act_mon_u-1");
    expect(a.suggested_payload).toEqual({});
  });

  describe("priority ordering", () => {
    it("FSRS review wins over weak specialty when lapses>=2 && retention<70", () => {
      const a = computeProfessorAction(
        baseRisk({ avg_lapses: 2, retention_score: 69, weak_specialty: "Cardio", risk_level: "critical" })
      );
      expect(a.action_type).toBe("assign_fsrs_review");
      expect(a.severity).toBe("high");
      expect(a.suggested_payload.target_specialty).toBe("Cardio");
    });

    it("weak specialty wins over overload when risk != low", () => {
      const a = computeProfessorAction(
        baseRisk({
          weak_specialty: "Pediatria",
          risk_level: "warning",
          overload_score: 40,
          burnout_risk: "high",
        })
      );
      expect(a.action_type).toBe("assign_recovery");
      expect(a.suggested_payload.specialty).toBe("Pediatria");
      expect(a.severity).toBe("high");
    });

    it("overload wins over inactivity when burnout != low", () => {
      const a = computeProfessorAction(
        baseRisk({ overload_score: 50, burnout_risk: "moderate", inactive_days: 10 })
      );
      expect(a.action_type).toBe("reduce_load");
      expect(a.severity).toBe("high");
    });

    it("critical severity when burnout is high on reduce_load", () => {
      const a = computeProfessorAction(
        baseRisk({ overload_score: 50, burnout_risk: "high" })
      );
      expect(a.severity).toBe("critical");
    });
  });

  describe("edge thresholds", () => {
    it("FSRS branch does NOT trigger when retention exactly = 70", () => {
      const a = computeProfessorAction(baseRisk({ avg_lapses: 3, retention_score: 70 }));
      expect(a.action_type).not.toBe("assign_fsrs_review");
    });

    it("FSRS branch does NOT trigger when lapses < 2", () => {
      const a = computeProfessorAction(baseRisk({ avg_lapses: 1.9, retention_score: 50 }));
      expect(a.action_type).not.toBe("assign_fsrs_review");
    });

    it("weak specialty branch does NOT trigger when risk_level = low", () => {
      const a = computeProfessorAction(baseRisk({ weak_specialty: "GO", risk_level: "low" }));
      expect(a.action_type).not.toBe("assign_recovery");
    });

    it("overload branch does NOT trigger when overload = 30", () => {
      const a = computeProfessorAction(baseRisk({ overload_score: 30, burnout_risk: "moderate" }));
      expect(a.action_type).not.toBe("reduce_load");
    });

    it("overload branch does NOT trigger when burnout = low", () => {
      const a = computeProfessorAction(baseRisk({ overload_score: 50, burnout_risk: "low" }));
      expect(a.action_type).not.toBe("reduce_load");
    });
  });

  describe("inactivity", () => {
    it("opens mentoria at inactive_days = 5", () => {
      const a = computeProfessorAction(baseRisk({ inactive_days: 5 }));
      expect(a.action_type).toBe("open_mentory");
      expect(a.severity).toBe("high");
    });

    it("critical severity at inactive_days >= 14", () => {
      const a = computeProfessorAction(baseRisk({ inactive_days: 14 }));
      expect(a.action_type).toBe("open_mentory");
      expect(a.severity).toBe("critical");
    });

    it("does NOT open mentoria at inactive_days = 4", () => {
      const a = computeProfessorAction(baseRisk({ inactive_days: 4 }));
      expect(a.action_type).toBe("monitor");
    });
  });

  describe("fallback branches", () => {
    it("assigns adaptive simulado when suggested_action='simulado_adaptativo'", () => {
      const a = computeProfessorAction(
        baseRisk({ suggested_action: "simulado_adaptativo", weak_specialty: "Neuro", justification: "por baixo desempenho" })
      );
      expect(a.action_type).toBe("assign_adaptive_simulado");
      expect(a.severity).toBe("medium");
      expect(a.suggested_payload.specialty).toBe("Neuro");
      expect(a.justification).toBe("por baixo desempenho");
    });
  });

  describe("null-safety", () => {
    it("treats null lapses as 0 and null retention as 100", () => {
      const a = computeProfessorAction(baseRisk({ avg_lapses: null, retention_score: null }));
      expect(a.action_type).toBe("monitor");
    });
  });

  it("all returned actions carry a stable id prefixed by user_id", () => {
    const a = computeProfessorAction(baseRisk({ inactive_days: 7 }));
    expect(a.id).toBe("act_mentory_u-1");
  });
});
