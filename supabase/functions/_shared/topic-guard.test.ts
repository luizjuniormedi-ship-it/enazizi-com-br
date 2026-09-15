import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isVisibleTopicCompatibleWithRequest, validateFinalQuestionTopic } from "./topic-guard.ts";

Deno.test("visible topic guard rejects contaminated Cardiology metadata", () => {
  const contaminated = {
    topic: "Doença de Caroli",
    curriculum_theme: "Cardiologia",
    subtopic: null,
    curriculum_subtheme: null,
  };

  assertEquals(validateFinalQuestionTopic(contaminated, "Cardiologia").allowed, true);
  assertEquals(isVisibleTopicCompatibleWithRequest(contaminated, "Cardiologia"), false);
});

Deno.test("visible topic guard accepts explicit Cardiology subtopics", () => {
  assertEquals(
    isVisibleTopicCompatibleWithRequest({
      topic: "IAM com Supra de ST",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia"),
    true,
  );

  assertEquals(
    isVisibleTopicCompatibleWithRequest({
      topic: "Insuficiência Cardíaca",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia"),
    true,
  );
});

Deno.test("visible topic guard accepts Internal Medicine umbrella metadata for Cardiology", () => {
  assertEquals(
    isVisibleTopicCompatibleWithRequest({
      topic: "Clínica Médica",
      curriculum_theme: "Cardiologia",
    }, "Cardiologia"),
    true,
  );
});
