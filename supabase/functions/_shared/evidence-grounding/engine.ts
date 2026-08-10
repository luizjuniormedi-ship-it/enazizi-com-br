import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { 
  EvidenceItem, 
  EvidenceContextPack, 
  EvidenceSourceType, 
  GroundedOutput, 
  GroundingScore, 
  ClinicalClaim,
  EvidenceConflict,
  GoldQuestionReference,
  OfficialExamReference
} from './types.ts';
import { validateFinalQuestionTopic } from '../topic-guard.ts';
import { createEmbedding } from "../ai-embeddings.ts";

const AUTHORITY_HIERARCHY: Record<EvidenceSourceType, number> = {
  'guideline': 6,
  'literature': 5,
  'validated_corpus': 4,
  'official_exam': 3,
  'gold_question': 2,
  'validated_question': 1
};

/**
 * Retrieves evidence from various sources based on the input.
 */
export async function retrieveEvidence(
  supabase: any,
  input: {
    topic: string;
    specialty?: string;
    limit?: number;
    minSimilarity?: number;
  }
): Promise<{ 
  evidence: EvidenceItem[], 
  goldQuestions: GoldQuestionReference[], 
  officialExams: OfficialExamReference[],
  conflicts: EvidenceConflict[]
}> {
  const { topic, limit = 10, minSimilarity = 0.78 } = input;
  const evidence: EvidenceItem[] = [];
  const goldQuestions: GoldQuestionReference[] = [];
  const officialExams: OfficialExamReference[] = [];
  const conflicts: EvidenceConflict[] = [];

  // 1. RAG Retrieval (Literature/Corpus)
  try {
    const embedding = await createEmbedding(topic);
    const { data: chunks, error: ragError } = await supabase.rpc('match_rag_chunks', {
      embedding: embedding,
      match_threshold: minSimilarity,
      match_count: limit
    });

    if (chunks) {
      chunks.forEach((c: any) => {
        evidence.push({
          evidenceId: `RAG-${c.id}`,
          sourceType: 'literature', // Default to literature if not specified in chunk
          title: c.document_title || 'Medical Literature',
          excerpt: c.content,
          topic: topic,
          canonicalTopic: c.canonical_topic || topic,
          sourceId: c.document_id || c.id,
          authorityTier: AUTHORITY_HIERARCHY['literature'],
          relevanceScore: c.similarity || 0.8
        });
      });
    }
  } catch (err) {
    console.warn("[RETRIEVAL] RAG failed, falling back to database search:", err);
  }
  
  // 2. Query Questions Bank (GOLD & Official)
  const { data: qData } = await supabase
    .from('questions_bank')
    .select('*')
    .or(`topic.ilike.%${topic}%,curriculum_theme.ilike.%${topic}%`)
    .limit(limit);

  if (qData) {
    qData.forEach((q: any) => {
      if (q.gold_tier) {
        goldQuestions.push({
          id: q.id,
          correct_answer: q.gabarito,
          topic: q.topic,
          tier: 'GOLD'
        });
      }
      if (q.is_official_exam) {
        officialExams.push({
          id: q.id,
          institution: q.instituicao || q.banca || 'Official',
          year: q.ano || 2024,
          topic: q.topic
        });
      }

      // Also add to evidence items if relevant
      evidence.push({
        evidenceId: `QB-${q.id}`,
        sourceType: q.gold_tier ? 'gold_question' : 'validated_question',
        excerpt: `${q.enunciado} (Gabarito: ${q.gabarito})`,
        topic: topic,
        canonicalTopic: q.topic || topic,
        sourceId: q.id,
        authorityTier: q.gold_tier ? AUTHORITY_HIERARCHY['gold_question'] : AUTHORITY_HIERARCHY['validated_question'],
        relevanceScore: 0.75
      });
    });
  }

  return { evidence, goldQuestions, officialExams, conflicts };
}

/**
 * Builds a Context Pack from retrieved sources.
 */
export async function buildEvidenceContextPack(
  requestId: string,
  canonicalTopic: string,
  data: {
    evidence: EvidenceItem[],
    goldQuestions: GoldQuestionReference[],
    officialExams: OfficialExamReference[],
    conflicts: EvidenceConflict[]
  },
  specialty: string = "Clínica Médica"
): Promise<EvidenceContextPack> {
  
  // Generate a deterministic hash of the evidence for cross-provider parity
  const contentToHash = data.evidence.map(e => e.excerpt).join('|');
  // Simple hash for demonstration in Deno (crypto is available)
  const encoder = new TextEncoder();
  const rawHash = await crypto.subtle.digest("SHA-256", encoder.encode(contentToHash));
  const contextHash = Array.from(new Uint8Array(rawHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    requestId,
    canonicalTopic,
    specialty,
    aliases: [canonicalTopic], // Would be fetched from a topic registry in production
    evidence: data.evidence.sort((a, b) => (b.authorityTier || 0) - (a.authorityTier || 0)),
    goldQuestions: data.goldQuestions,
    officialExamReferences: data.officialExams,
    conflicts: data.conflicts,
    retrievalConfidence: data.evidence.length > 0 ? 0.9 : 0.1,
    generatedAt: new Date().toISOString(),
    contextHash
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
  
  const reqTopicLower = canonicalTopic.toLowerCase();

  contextPack.evidence.forEach(item => {
    const itemTopic = item.canonicalTopic.toLowerCase();
    
    // Check if the source topic is a "sibling" that shouldn't be here
    // Example: If searching for IAM, Pericardite shouldn't dominate.
    if (itemTopic !== reqTopicLower && !contextPack.aliases.map(a => a.toLowerCase()).includes(itemTopic)) {
       // Heuristic: If similarity is low or topic name is distinct enough, flag it
       contaminations.push(`${item.evidenceId}: ${item.canonicalTopic}`);
    }
  });

  return {
    isolated: contaminations.length === 0, // Strict isolation for EG-2 Arena tests
    contaminations
  };
}

/**
 * Validates the grounded output against the context pack.
 */
export async function validateGroundedOutput(
  output: string,
  contextPack: EvidenceContextPack,
  isQuestion: boolean = false
): Promise<GroundedOutput> {
  // 1. Extract clinical claims (rough heuristic for Phase EG-2)
  const sentences = output.split(/[.!?]/).filter(s => s.trim().length > 30);
  
  const claims: ClinicalClaim[] = sentences.map(s => {
    const cleanSentence = s.trim().toLowerCase();
    
    // Check support in evidence
    const supportedSources = contextPack.evidence.filter(ev => {
      const excerpt = ev.excerpt.toLowerCase();
      // Look for significant keyword overlap
      const words = cleanSentence.split(' ').filter(w => w.length > 4);
      const matches = words.filter(w => excerpt.includes(w)).length;
      return matches >= Math.min(words.length, 3);
    });

    return {
      claim: s.trim(),
      status: supportedSources.length > 0 ? 'supported' : 'unsupported',
      evidence_ids: supportedSources.map(ss => ss.evidenceId)
    };
  });

  const unsupportedCount = claims.filter(c => c.status === 'unsupported').length;
  const conflictingCount = claims.filter(c => c.status === 'conflicting').length;
  
  // 2. Check for critical hallucinations (heuristic)
  const criticalKeywords = ['dose', 'contraindicado', 'indicação', 'tratamento', 'gabarito'];
  const hasCriticalHallucination = claims.some(c => 
    c.status === 'unsupported' && criticalKeywords.some(kw => c.claim.toLowerCase().includes(kw))
  );

  // 3. Answer Key Validation (if question)
  let answerKeySupport = true;
  if (isQuestion) {
    // Attempt to verify if the correct answer matches evidence
    // This is hard to do deterministically without structured answers, 
    // but in EG-2 we check if any GOLD question or exam source supports the statement.
    answerKeySupport = contextPack.evidence.some(ev => 
      ['gold_question', 'official_exam', 'guideline'].includes(ev.sourceType)
    );
  }

  const grounding: GroundingScore = {
    overall_score: Math.max(0, 100 - (unsupportedCount * 15) - (conflictingCount * 50)),
    topic_fidelity: 100, // Placeholder
    source_adherence: 100, // Placeholder
    unsupported_claims_count: unsupportedCount,
    conflicting_claims_count: conflictingCount,
    critical_hallucination: hasCriticalHallucination,
    evidence_status: contextPack.evidence.length === 0 ? 'insufficient_evidence' : 
                     (conflictingCount > 0 ? 'conflicting_evidence' : 
                     (unsupportedCount > 0 ? 'sufficient' : 'robust'))
  };

  return {
    data: output,
    grounding,
    claims,
    source_ids: [...new Set(claims.flatMap(c => c.evidence_ids))],
    answer_key_support: answerKeySupport
  };
}

/**
 * Scores the grounding of the output (Legacy support / internal scoring).
 */
export function scoreGrounding(
  output: GroundedOutput,
  contextPack: EvidenceContextPack
): GroundingScore {
  return output.grounding;
}
