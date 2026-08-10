import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { 
  EvidenceSource, 
  EvidenceContextPack, 
  EvidenceSourceType, 
  GroundedOutput, 
  GroundingScore, 
  ClinicalClaim 
} from './types.ts';
import { validateFinalQuestionTopic } from '../topic-guard.ts';

const EVIDENCE_HIERARCHY: EvidenceSourceType[] = [
  'official_guideline',
  'medical_literature',
  'validated_corpus',
  'official_exam',
  'gold_question',
  'validated_question'
];

/**
 * Retrieves evidence from various sources based on the input.
 */
export async function retrieveEvidence(
  supabase: any,
  input: {
    topic: string;
    subtopic?: string;
    limit?: number;
    minSimilarity?: number;
  }
): Promise<EvidenceSource[]> {
  const { topic, subtopic, limit = 5, minSimilarity = 0.78 } = input;
  const sources: EvidenceSource[] = [];

  // 1. RAG Retrieval (Literature/Corpus)
  // We need to generate embeddings for the topic first (usually done upstream, but here we assume it's part of the retrieval flow)
  // For FASE EG-1, we will mock the embedding generation or use a placeholder if not available.
  // Actually, let's try to use the match_rag_chunks RPC if we had embeddings.
  
  // 2. Query Official Exams & GOLD Questions (Structured retrieval)
  const { data: questions } = await supabase
    .from('questions_bank')
    .select('*')
    .or(`topic.ilike.%${topic}%,subtopic.ilike.%${topic}%`)
    .limit(limit);

  if (questions) {
    questions.forEach((q: any) => {
      sources.push({
        id: q.id,
        type: q.is_official_exam ? 'official_exam' : (q.gold_tier ? 'gold_question' : 'validated_question'),
        title: q.exam_name || `Question ${q.id}`,
        content: `${q.enunciado} ${q.comentario || ''}`,
        canonical_topic: q.topic,
        metadata: { specialty: q.specialty, year: q.year },
        gold_tier: q.gold_tier
      });
    });
  }

  // 3. RAG Chunks (if embeddings are handled)
  // This is a placeholder for actual vector search implementation
  // const { data: chunks } = await supabase.rpc('match_rag_chunks', { ... });

  return sources;
}

/**
 * Builds a Context Pack from retrieved sources.
 */
export function buildEvidenceContextPack(
  requestId: string,
  canonicalTopic: string,
  sources: EvidenceSource[]
): EvidenceContextPack {
  const typeCounts: Record<string, number> = {};
  sources.forEach(s => {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  });

  return {
    request_id: requestId,
    canonical_topic: canonicalTopic,
    sources,
    hierarchy: EVIDENCE_HIERARCHY,
    metadata: {
      source_count: sources.length,
      source_type_counts: typeCounts,
      topic_match_score: sources.length > 0 ? 100 : 0 // Placeholder
    }
  };
}

/**
 * Asserts that the context pack is isolated to the canonical topic.
 * Prevents "sibling contamination".
 */
export function assertTopicIsolation(
  contextPack: EvidenceContextPack,
  canonicalTopic: string
): { isolated: boolean; contaminations: string[] } {
  const contaminations: string[] = [];
  
  // Logic: check if sources belong to a different topic that is NOT an alias or child of the canonical topic
  contextPack.sources.forEach(source => {
    if (source.canonical_topic && source.canonical_topic.toLowerCase() !== canonicalTopic.toLowerCase()) {
      // In a real scenario, check aliases here.
      contaminations.push(`${source.id}: ${source.canonical_topic}`);
    }
  });

  return {
    isolated: contaminations.length === 0,
    contaminations
  };
}

/**
 * Validates the grounded output against the context pack.
 */
export async function validateGroundedOutput(
  output: string,
  contextPack: EvidenceContextPack
): Promise<{ claims: ClinicalClaim[], score: GroundingScore }> {
  // In EG-1, this is a deterministic/heuristic validation.
  // We extract "claims" (sentences) and check for keyword presence in sources.
  
  const sentences = output.split(/[.!?]/).filter(s => s.trim().length > 20);
  const claims: ClinicalClaim[] = sentences.map(s => {
    const supportedSources = contextPack.sources.filter(source => 
      source.content.toLowerCase().includes(s.toLowerCase().split(' ').slice(0, 5).join(' '))
    );

    return {
      claim: s.trim(),
      status: supportedSources.length > 0 ? 'supported' : 'unsupported',
      evidence_ids: supportedSources.map(ss => ss.id)
    };
  });

  const unsupportedCount = claims.filter(c => c.status === 'unsupported').length;
  const conflictingCount = claims.filter(c => c.status === 'conflicting').length;
  
  const score: GroundingScore = {
    overall_score: Math.max(0, 100 - (unsupportedCount * 10) - (conflictingCount * 50)),
    topic_fidelity: 100, // Placeholder
    source_adherence: 100, // Placeholder
    unsupported_claims_count: unsupportedCount,
    conflicting_claims_count: conflictingCount,
    evidence_status: contextPack.sources.length === 0 ? 'insufficient_evidence' : 
                     (conflictingCount > 0 ? 'conflicting_evidence' : 
                     (unsupportedCount > 0 ? 'sufficient' : 'robust'))
  };

  return { claims, score };
}

/**
 * Scores the grounding of the output.
 */
export function scoreGrounding(
  output: any,
  contextPack: EvidenceContextPack
): GroundingScore {
  // Heuristic score calculation
  const sourceIds = new Set(contextPack.sources.map(s => s.id));
  const mentionedIds = (output.source_ids || []).filter((id: string) => sourceIds.has(id));
  
  const adherence = contextPack.sources.length > 0 ? (mentionedIds.length / contextPack.sources.length) * 100 : 0;
  
  return {
    overall_score: adherence,
    topic_fidelity: output.topic_match_score || 0,
    source_adherence: adherence,
    unsupported_claims_count: output.unsupported_claims_count || 0,
    conflicting_claims_count: output.conflicting_claims_count || 0,
    evidence_status: output.evidence_status || 'insufficient_evidence'
  };
}
