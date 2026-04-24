import { describe, it, expect } from "vitest";
import { validateCognitiveBlock, validateTutorBlocks } from "@/lib/tutor/blockValidation";

describe("blockValidation › clinical_flow", () => {
  it("aceita payload válido", () => {
    const out = validateCognitiveBlock({
      type: "clinical_flow",
      payload: {
        title: "Sepse",
        nodes: [
          { id: "a", label: "Suspeita" },
          { id: "b", label: "Conduta" },
        ],
        edges: [{ from: "a", to: "b" }],
      },
    });
    expect(out.ok).toBe(true);
  });

  it("remove edges órfãs", () => {
    const out = validateCognitiveBlock({
      type: "clinical_flow",
      payload: {
        nodes: [{ id: "a", label: "x" }],
        edges: [
          { from: "a", to: "ZZ" },
          { from: "a", to: "a" }, // self-loop
        ],
      },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "clinical_flow") {
      expect(out.block.payload.edges.length).toBe(0);
      expect(out.sanitized).toBe(true);
    }
  });

  it("dedupe ids duplicados", () => {
    const out = validateCognitiveBlock({
      type: "clinical_flow",
      payload: {
        nodes: [
          { id: "a", label: "1" },
          { id: "a", label: "2" },
        ],
        edges: [],
      },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "clinical_flow") {
      expect(out.block.payload.nodes.length).toBe(1);
    }
  });

  it("rejeita quando não há nodes válidos", () => {
    const out = validateCognitiveBlock({
      type: "clinical_flow",
      payload: { nodes: [{ id: "" }], edges: [] },
    });
    expect(out.ok).toBe(false);
  });
});

describe("blockValidation › differential_diagnosis", () => {
  it("clamp probability em 0..1", () => {
    const out = validateCognitiveBlock({
      type: "differential_diagnosis",
      payload: {
        items: [
          { name: "SCA", probability: 1.7, severity: "alta" },
          { name: "Ansiedade", probability: -0.3, severity: "invalida" },
        ],
      },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "differential_diagnosis") {
      expect(out.block.payload.items[0].probability).toBe(1);
      expect(out.block.payload.items[1].probability).toBe(0);
      expect(out.block.payload.items[1].severity).toBeUndefined();
    }
  });

  it("remove items sem nome", () => {
    const out = validateCognitiveBlock({
      type: "differential_diagnosis",
      payload: { items: [{ name: "" }, { name: "TEP" }] },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "differential_diagnosis") {
      expect(out.block.payload.items.length).toBe(1);
    }
  });
});

describe("blockValidation › pharmacology_compare", () => {
  it("remove drogas sem nome e arrays nulos", () => {
    const out = validateCognitiveBlock({
      type: "pharmacology_compare",
      payload: {
        drugs: [
          { name: "", adverse: null },
          { name: "Losartana", adverse: ["tosse", null, "  "], contraindications: null },
        ],
      },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "pharmacology_compare") {
      expect(out.block.payload.drugs.length).toBe(1);
      expect(out.block.payload.drugs[0].adverse).toEqual(["tosse"]);
    }
  });
});

describe("blockValidation › semiology_insight", () => {
  it("remove maneuvers sem nome", () => {
    const out = validateCognitiveBlock({
      type: "semiology_insight",
      payload: { maneuvers: [{ name: "" }, { name: "Murphy" }] },
    });
    expect(out.ok).toBe(true);
    if (out.ok && out.block.type === "semiology_insight") {
      expect(out.block.payload.maneuvers.length).toBe(1);
    }
  });
});

describe("validateTutorBlocks › lista mista", () => {
  it("preserva blocos não cognitivos e relata rejeições", () => {
    const r = validateTutorBlocks([
      { type: "summary", payload: { title: "x", bullets: ["a"] } },
      { type: "clinical_flow", payload: { nodes: [], edges: [] } }, // rejected
      {
        type: "differential_diagnosis",
        payload: { items: [{ name: "TEP" }] },
      },
    ]);
    expect(r.blocks.length).toBe(2);
    expect(r.rejected.length).toBe(1);
    expect(r.rejected[0].block_type).toBe("clinical_flow");
  });
});
