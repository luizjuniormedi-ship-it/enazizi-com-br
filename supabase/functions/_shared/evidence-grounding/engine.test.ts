import { assertEquals } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { 
  retrieveEvidence, 
  buildEvidenceContextPack, 
  assertTopicIsolation,
  validateGroundedOutput
} from "./engine.ts";
import { EvidenceSource } from "./types.ts";

Deno.test("Evidence Grounding - buildEvidenceContextPack", () => {
  const sources: EvidenceSource[] = [
    { id: "1", type: "official_guideline", content: "Guidelines for IAM" },
    { id: "2", type: "medical_literature", content: "Clinical study on IAM" }
  ];
  
  const pack = buildEvidenceContextPack("test-req", "IAM", sources);
  
  assertEquals(pack.canonical_topic, "IAM");
  assertEquals(pack.sources.length, 2);
  assertEquals(pack.metadata.source_type_counts.official_guideline, 1);
});

Deno.test("Evidence Grounding - assertTopicIsolation", () => {
  const sources: EvidenceSource[] = [
    { id: "1", type: "official_guideline", content: "IAM data", canonical_topic: "IAM" },
    { id: "2", type: "official_guideline", content: "Pericardite data", canonical_topic: "Pericardite" }
  ];
  
  const pack = buildEvidenceContextPack("test-req", "IAM", sources);
  const result = assertTopicIsolation(pack, "IAM");
  
  assertEquals(result.isolated, false);
  assertEquals(result.contaminations.length, 1);
});

Deno.test("Evidence Grounding - validateGroundedOutput (Basic Heuristic)", async () => {
  const sources: EvidenceSource[] = [
    { id: "1", type: "official_guideline", content: "O tratamento do IAM com supra de ST deve incluir AAS e clopidogrel." }
  ];
  
  const pack = buildEvidenceContextPack("test-req", "IAM", sources);
  
  // Supported claim
  const output = "O tratamento do IAM com supra de ST deve incluir AAS.";
  const result = await validateGroundedOutput(output, pack);
  
  assertEquals(result.score.evidence_status, "sufficient");
  assertEquals(result.claims[0].status, "supported");
  
  // Unsupported claim
  const output2 = "A pneumonia deve ser tratada com amoxicilina.";
  const result2 = await validateGroundedOutput(output2, pack);
  assertEquals(result2.claims[0].status, "unsupported");
});
