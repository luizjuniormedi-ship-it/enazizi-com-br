import { describe, it, expect } from "vitest";
import {
  isTutorBlock,
  type TutorBlock,
  type ClinicalFlowBlock,
  type DifferentialDiagnosisBlock,
  type PharmacologyCompareBlock,
  type SemiologyInsightBlock,
} from "@/types/tutor";

/**
 * Contract tests — Tutor Cognitive Blocks.
 * Garante que o type guard `isTutorBlock` aceita todos os 12 tipos do union
 * e rejeita payloads malformados.
 */

const validBlocks: TutorBlock[] = [
  { type: "summary", payload: { title: "x", bullets: ["a"] } },
  { type: "lay_explanation", payload: { text: "x" } },
  { type: "deep_dive", payload: { markdown: "# t" } },
  { type: "comparison_table", payload: { headers: ["a"], rows: [["1"]] } },
  {
    type: "clinical_flow",
    payload: {
      nodes: [{ id: "n1", label: "A" }],
      edges: [],
    },
  } satisfies ClinicalFlowBlock,
  {
    type: "mini_quiz",
    payload: { stem: "?", options: ["a", "b"], correct_index: 0, explanation: "ok" },
  },
  {
    type: "mnemonic_reinforce",
    payload: { phrase: "ABC", items: ["A", "B", "C"] },
  },
  { type: "next_steps", payload: { actions: [{ kind: "open_session", label: "ir" }] } },
  { type: "reference", payload: { refs: [{ source: "Harrison" }] } },
  {
    type: "differential_diagnosis",
    payload: { items: [{ name: "TEP", probability: 0.5, doNotMiss: true }] },
  } satisfies DifferentialDiagnosisBlock,
  {
    type: "pharmacology_compare",
    payload: { drugs: [{ name: "Losartana", class: "BRA", preferred: true }] },
  } satisfies PharmacologyCompareBlock,
  {
    type: "semiology_insight",
    payload: { maneuvers: [{ name: "Murphy", finding: "interrupção da inspiração" }] },
  } satisfies SemiologyInsightBlock,
];

describe("TutorBlock contract", () => {
  it.each(validBlocks)("aceita bloco válido: $type", (block) => {
    expect(isTutorBlock(block)).toBe(true);
  });

  it("rejeita type desconhecido", () => {
    expect(isTutorBlock({ type: "foo_bar", payload: {} })).toBe(false);
  });

  it("rejeita payload ausente", () => {
    expect(isTutorBlock({ type: "summary" })).toBe(false);
  });

  it("rejeita null/undefined/primitivos", () => {
    expect(isTutorBlock(null)).toBe(false);
    expect(isTutorBlock(undefined)).toBe(false);
    expect(isTutorBlock("clinical_flow")).toBe(false);
    expect(isTutorBlock(42)).toBe(false);
  });
});
