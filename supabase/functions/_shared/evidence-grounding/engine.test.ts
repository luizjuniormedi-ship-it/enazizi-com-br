import { assertEquals } from "https://deno.land/std@0.208.0/testing/asserts.ts";
import { 
  buildEvidenceContextPack, 
  assertTopicIsolation,
  validateGroundedOutput
} from "./engine.ts";
import { EvidenceItem } from "./types.ts";

Deno.test("Evidence Grounding EG-3 - buildEvidenceContextPack with Hash", async () => {
  const data = {
    evidence: [
      { 
        evidenceId: "PMID-1", 
        sourceType: "pubmed_abstract" as const, 
        excerpt: "PubMed study on IAM", 
        topic: "IAM", 
        canonicalTopic: "IAM", 
        sourceId: "1",
        authorityTier: 6,
        relevanceScore: 0.9,
        title: "Study 1",
        fullTextAvailable: false,
        retrievedAt: new Date().toISOString()
      }
    ],
    goldQuestions: [],
    officialExamRefs: [],
    conflicts: []
  };
  
  const pack = await buildEvidenceContextPack("test-req", "IAM", data);
  
  assertEquals(pack.canonicalTopic, "IAM");
  assertEquals(pack.evidence.length, 1);
  assertEquals(typeof pack.contextHash, "string");
  assertEquals(pack.contextHash.length, 64); // SHA-256 hex
});

Deno.test("Evidence Grounding EG-3 - validateGroundedOutput with Hallucination", async () => {
  const data = {
    evidence: [
      { 
        evidenceId: "EV1", 
        sourceType: "guideline" as const, 
        excerpt: "O tratamento do IAM com supra de ST deve incluir AAS e clopidogrel.",
        topic: "IAM",
        canonicalTopic: "IAM",
        sourceId: "G1",
        relevanceScore: 1,
        authorityTier: 10,
        title: "Guideline 1",
        fullTextAvailable: true,
        retrievedAt: new Date().toISOString()
      }
    ],
    goldQuestions: [],
    officialExamRefs: [],
    conflicts: []
  };
  
  const pack = await buildEvidenceContextPack("test-req", "IAM", data);
  
  // Supported claim
  const output = "O tratamento do IAM deve incluir AAS.";
  const result = await validateGroundedOutput(output, pack);
  
  assertEquals(result.grounding.evidence_status, "robust");
  assertEquals(result.claims[0].status, "supported");
  
  // Critical hallucination
  const output2 = "A dose recomendada de amoxicilina é 1g.";
  const result2 = await validateGroundedOutput(output2, pack);
  assertEquals(result2.grounding.critical_hallucination, true);
  assertEquals(result2.grounding.unsupported_claim_rate, 1);
});
