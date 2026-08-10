import { EvidenceContextPack, GroundedOutput, GroundingScore } from './types.ts';
import { 
  retrieveEvidence, 
  buildEvidenceContextPack, 
  validateGroundedOutput, 
  assertTopicIsolation 
} from './engine.ts';

/**
 * SHADOW CONTRACT: generateGroundedQuestion
 * Receives context and constraints, returns grounded output.
 */
export async function generateGroundedQuestion(
  supabase: any,
  input: {
    topic: string;
    constraints: Record<string, any>;
    requestId: string;
  }
): Promise<GroundedOutput> {
  // 1. Retrieval
  const sources = await retrieveEvidence(supabase, { topic: input.topic });
  const contextPack = buildEvidenceContextPack(input.requestId, input.topic, sources);

  // 2. Isolation Check
  const isolation = assertTopicIsolation(contextPack, input.topic);

  // 3. Insufficient Evidence Early Exit (Shadow)
  if (contextPack.sources.length === 0) {
    return {
      data: null,
      source_ids: [],
      claims: [],
      grounding: {
        overall_score: 0,
        topic_fidelity: 0,
        source_adherence: 0,
        unsupported_claims_count: 0,
        conflicting_claims_count: 0,
        evidence_status: 'insufficient_evidence'
      },
      answer_key_support: false
    };
  }

  // 4. Mock AI Generation (In a real scenario, this would call callAI with the contextPack)
  const mockQuestion = {
    enunciado: `Questão sobre ${input.topic} baseada em ${contextPack.sources.length} fontes.`,
    alternativas: ["A", "B", "C", "D"],
    resposta_correta: "A",
    source_ids: contextPack.sources.map(s => s.id)
  };

  // 5. Grounding Validation
  const validation = await validateGroundedOutput(JSON.stringify(mockQuestion), contextPack);

  return {
    data: mockQuestion,
    source_ids: mockQuestion.source_ids,
    claims: validation.claims,
    grounding: validation.score,
    answer_key_support: validation.score.overall_score > 70
  };
}

/**
 * SHADOW CONTRACT: generateGroundedTutorResponse
 */
export async function generateGroundedTutorResponse(
  supabase: any,
  input: {
    message: string;
    topic: string;
    requestId: string;
  }
): Promise<GroundedOutput> {
  const sources = await retrieveEvidence(supabase, { topic: input.topic });
  const contextPack = buildEvidenceContextPack(input.requestId, input.topic, sources);
  
  // Logic simplified for foundation phase
  const validation = await validateGroundedOutput("Mock grounded tutor response", contextPack);

  return {
    data: "Mock response",
    source_ids: sources.map(s => s.id),
    claims: validation.claims,
    grounding: validation.score
  };
}

/**
 * SHADOW CONTRACT: generateGroundedClinicalResponse (Simulação/Plantão)
 */
export async function generateGroundedClinicalResponse(
  supabase: any,
  input: {
    scenario: string;
    topic: string;
    requestId: string;
  }
): Promise<GroundedOutput> {
  const sources = await retrieveEvidence(supabase, { topic: input.topic });
  const contextPack = buildEvidenceContextPack(input.requestId, input.topic, sources);
  
  const validation = await validateGroundedOutput("Mock clinical response", contextPack);

  return {
    data: "Mock clinical case",
    source_ids: sources.map(s => s.id),
    claims: validation.claims,
    grounding: validation.score
  };
}
