import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClinicalFlowRenderer } from "@/components/tutor/cognitive/ClinicalFlowRenderer";
import { DifferentialDiagnosisBoard } from "@/components/tutor/cognitive/DifferentialDiagnosisBoard";
import { PharmacologyCompareCard } from "@/components/tutor/cognitive/PharmacologyCompareCard";
import { SemiologyInsightCard } from "@/components/tutor/cognitive/SemiologyInsightCard";
import type {
  ClinicalFlowBlock,
  DifferentialDiagnosisBlock,
  PharmacologyCompareBlock,
  SemiologyInsightBlock,
} from "@/types/tutor";

/** Fallbacks: payload vazio/malformado NÃO deve quebrar a UI. */

describe("Cognitive UI fallbacks", () => {
  it("ClinicalFlowRenderer: vazio → empty state", () => {
    const block: ClinicalFlowBlock = { type: "clinical_flow", payload: { nodes: [], edges: [] } };
    render(<ClinicalFlowRenderer block={block} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("ClinicalFlowRenderer: edge órfã não quebra render", () => {
    const block: ClinicalFlowBlock = {
      type: "clinical_flow",
      payload: {
        nodes: [{ id: "n1", label: "Avaliar" }],
        // edge aponta para nó inexistente — deve ser descartada
        edges: [{ from: "n1", to: "n_fantasma" }],
      },
    };
    render(<ClinicalFlowRenderer block={block} />);
    expect(screen.getByText("Avaliar")).toBeInTheDocument();
  });

  it("ClinicalFlowRenderer: dedup de ids duplicados", () => {
    const block: ClinicalFlowBlock = {
      type: "clinical_flow",
      payload: {
        nodes: [
          { id: "n1", label: "Original" },
          { id: "n1", label: "Duplicata" },
        ],
        edges: [],
      },
    };
    render(<ClinicalFlowRenderer block={block} />);
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.queryByText("Duplicata")).toBeNull();
  });

  it("DifferentialDiagnosisBoard: items vazio → empty state", () => {
    const block: DifferentialDiagnosisBlock = {
      type: "differential_diagnosis",
      payload: { items: [] },
    };
    render(<DifferentialDiagnosisBoard block={block} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("DifferentialDiagnosisBoard: probability fora de 0–1 é clampada", () => {
    const block: DifferentialDiagnosisBlock = {
      type: "differential_diagnosis",
      payload: {
        items: [
          { name: "TEP", probability: 1.5 },
          { name: "Pneumonia", probability: -0.2 },
        ],
      },
    };
    render(<DifferentialDiagnosisBoard block={block} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("PharmacologyCompareCard: drugs vazio → empty state", () => {
    const block: PharmacologyCompareBlock = {
      type: "pharmacology_compare",
      payload: { drugs: [] },
    };
    render(<PharmacologyCompareCard block={block} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("SemiologyInsightCard: maneuvers vazio → empty state", () => {
    const block: SemiologyInsightBlock = {
      type: "semiology_insight",
      payload: { maneuvers: [] },
    };
    render(<SemiologyInsightCard block={block} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("Tolera payload truncado/parcial sem crash", () => {
    // @ts-expect-error — simulando payload corrompido vindo da IA
    const broken: DifferentialDiagnosisBlock = { type: "differential_diagnosis", payload: {} };
    expect(() => render(<DifferentialDiagnosisBoard block={broken} />)).not.toThrow();
  });
});
