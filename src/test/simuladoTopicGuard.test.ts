import { describe, expect, it } from "vitest";
import { isVisibleTopicCompatibleWithRequest, validateFinalQuestionTopic } from "../../supabase/functions/_shared/topic-guard";

describe("simulado topic guard", () => {
  it("rejeita metadado contaminado que mascara o tópico visível", () => {
    const contaminated = {
      topic: "Doença de Caroli",
      curriculum_theme: "Cardiologia",
      subtopic: null,
      curriculum_subtheme: null,
    };

    expect(validateFinalQuestionTopic(contaminated, "Cardiologia").allowed).toBe(true);
    expect(isVisibleTopicCompatibleWithRequest(contaminated, "Cardiologia")).toBe(false);
  });

  it("aceita subtemas explícitos de Cardiologia", () => {
    expect(isVisibleTopicCompatibleWithRequest({
      topic: "IAM com Supra de ST",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia")).toBe(true);

    expect(isVisibleTopicCompatibleWithRequest({
      topic: "Insuficiência Cardíaca",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia")).toBe(true);
  });

  it("aceita metadado guarda-chuva de Clínica Médica quando o tema curricular confirma Cardiologia", () => {
    expect(isVisibleTopicCompatibleWithRequest({
      topic: "Clínica Médica",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia")).toBe(true);
  });
});
