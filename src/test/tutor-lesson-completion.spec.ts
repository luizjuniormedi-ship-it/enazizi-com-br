import { describe, it, expect } from "vitest";
import {
  decideTutorStep,
  isLastBlock,
  getNextBlock,
  BLOCK_SEQUENCE,
  type TutorBlockId,
} from "../../supabase/functions/_shared/tutor/pedagogical-logic.ts";

describe("Tutor V3 — Lesson Completion Regression", () => {
  const LAST: TutorBlockId = "BLOCO_9_RESUMO_ALTA_RETENCAO";

  it("Case 1: BLOCO_9 + continue → lessonComplete=true, no advance", () => {
    const r = decideTutorStep(LAST, "continue");
    expect(r.lessonComplete).toBe(true);
    expect(r.nextBlock).toBe(LAST);
    expect(r.stayInBlock).toBe(true);
  });

  it("Case 2: BLOCO_9 + answer_question → lessonComplete=true, no infinite getNextBlock", () => {
    const r = decideTutorStep(LAST, "answer_question");
    expect(r.lessonComplete).toBe(true);
    expect(r.nextBlock).toBe(LAST);
    // sanity: getNextBlock on last returns same (would loop without flag)
    expect(getNextBlock(LAST)).toBe(LAST);
  });

  it("Case 3: BLOCO_8 + continue → advances to BLOCO_9, lessonComplete falsy", () => {
    const r = decideTutorStep("BLOCO_8_QUESTAO_ESTILO_PROVA", "continue");
    expect(r.nextBlock).toBe(LAST);
    expect(r.lessonComplete).toBeFalsy();
    expect(r.stayInBlock).toBe(false);
  });

  it("Case 4: BLOCO_1 + continue → advances to BLOCO_2, lessonComplete falsy", () => {
    const r = decideTutorStep("BLOCO_1_MISSAO_CLINICA", "continue");
    expect(r.nextBlock).toBe("BLOCO_2_MAPA_DA_AULA");
    expect(r.lessonComplete).toBeFalsy();
  });

  it("isLastBlock identifies BLOCO_9 correctly", () => {
    expect(isLastBlock(LAST)).toBe(true);
    expect(isLastBlock("BLOCO_1_MISSAO_CLINICA")).toBe(false);
    expect(BLOCK_SEQUENCE[BLOCK_SEQUENCE.length - 1]).toBe(LAST);
  });

  it("doubt on BLOCO_9 stays in block without completing", () => {
    const r = decideTutorStep(LAST, "doubt");
    expect(r.stayInBlock).toBe(true);
    expect(r.lessonComplete).toBeFalsy();
  });

  it("new_topic on BLOCO_9 resets to BLOCO_1 without lessonComplete", () => {
    const r = decideTutorStep(LAST, "new_topic");
    expect(r.nextBlock).toBe("BLOCO_1_MISSAO_CLINICA");
    expect(r.lessonComplete).toBeFalsy();
  });
});
