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
  OfficialExamReference,
  StudyType
} from './types.ts';
import { validateFinalQuestionTopic } from '../topic-guard.ts';
import { createEmbedding } from "../ai-embeddings.ts";
import { searchPubMed, fetchPubMedRecords, fetchPubMedAbstracts, linkPubMedToPMC } from "../pubmed-client.ts";

const AUTHORITY_HIERARCHY: Record<EvidenceSourceType, number> = {
  'guideline': 10,
  'literature': 8,
  'pubmed_central_fulltext': 7,
  'pubmed_abstract': 6,
  'validated_corpus': 5,
  'official_exam': 4,
  'gold_question': 3,
  'validated_question': 2
};

/**
 * Retrieves evidence from various sources based on the input.
 * EG-3 Implementation: Internal RAG + PubMed Live Retrieval
 */
export async function retrieveEvidence(
  supabase: any,
  input: {
    topic: string;
    specialty?: string;
    limit?: number;
    minSimilarity?: number;
    useLiveRetrieval?: boolean;
    canonicalTopic?: string;
  }
): Promise<{ 
  evidence: EvidenceItem[], 
  goldQuestions: GoldQuestionReference[], 
  officialExams: OfficialExamReference[],
  conflicts: EvidenceConflict[]
}> {
  const { topic, limit = 10, minSimilarity = 0.78, useLiveRetrieval = false, canonicalTopic = topic } = input;
  const evidence: EvidenceItem[] = [];
  const goldQuestions: GoldQuestionReference[] = [];
  const officialExams: OfficialExamReference[] = [];
  const conflicts: EvidenceConflict[] = [];

  // 1. RAG Retrieval (L2 - Corpus Interno)
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
          sourceType: 'literature',
          title: c.document_title || 'Medical Literature',
          excerpt: c.content,
          topic: topic,
          canonicalTopic: c.canonical_topic || canonicalTopic,
          sourceId: c.document_id || c.id,
          authorityTier: AUTHORITY_HIERARCHY['literature'],
          relevanceScore: c.similarity || 0.8,
          fullTextAvailable: true,
          retrievedAt: new Date().toISOString()
        });
      });
    }
  } catch (err) {
    console.warn("[RETRIEVAL] RAG failed:", err);
  }

  // 2. Live Retrieval (L3 - PubMed / PMC)
  if (useLiveRetrieval || evidence.length < 3) {
    console.log(`[RETRIEVAL] L3 Live Retrieval triggered for: ${topic}`);
    try {
      const { ids } = await searchPubMed(topic, 5);
      if (ids.length > 0) {
        const records = await fetchPubMedRecords(ids);
        const abstracts = await fetchPubMedAbstracts(ids);
        const pmcLinks = await linkPubMedToPMC(ids);
        
        records.forEach(rec => {
          const hasPMC = !!pmcLinks[rec.pmid];
          evidence.push({
            evidenceId: `PMID-${rec.pmid}`,
            sourceType: hasPMC ? 'pubmed_central_fulltext' : 'pubmed_abstract',
            PMID: rec.pmid,
            PMCID: pmcLinks[rec.pmid],
            DOI: rec.doi,
            title: rec.title,
            excerpt: abstracts[rec.pmid] || "",
            abstract: abstracts[rec.pmid],
            publicationYear: rec.pubYear,
            journal: rec.journal,
            topic: topic,
            canonicalTopic: canonicalTopic,
            sourceId: rec.pmid,
            authorityTier: hasPMC ? AUTHORITY_HIERARCHY['pubmed_central_fulltext'] : AUTHORITY_HIERARCHY['pubmed_abstract'],
            relevanceScore: 0.85,
            fullTextAvailable: hasPMC,
            retrievedAt: new Date().toISOString()
          });
        });
      }
    } catch (err) {
      console.error("[RETRIEVAL] PubMed L3 failed:", err);
    }
  }
  
  // 3. Questions Bank (L2)
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
          correctAnswer: q.gabarito,
          topic: q.topic,
          tier: q.gold_tier === 'GOLD' ? 'GOLD' : 'SILVER'
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

      evidence.push({
        evidenceId: `QB-${q.id}`,
        sourceType: q.gold_tier ? 'gold_question' : 'validated_question',
        excerpt: `${q.enunciado} (Gabarito: ${q.gabarito})`,
        title: `Questão: ${q.topic}`,
        topic: topic,
        canonicalTopic: q.topic || canonicalTopic,
        sourceId: q.id,
        authorityTier: q.gold_tier ? AUTHORITY_HIERARCHY['gold_question'] : AUTHORITY_HIERARCHY['validated_question'],
        relevanceScore: 0.75,
        fullTextAvailable: false,
        retrievedAt: new Date().toISOString()
      });
    });
  }

  // Deduplicate by source_id
  const uniqueEvidence = Array.from(new Map(evidence.map(e => [e.sourceId, e])).values());

  return { evidence: uniqueEvidence, goldQuestions, officialExams, conflicts };
}

/**
 * Builds a Context Pack from retrieved sources.
 * EG-3 Implementation: Context Hash Parity + Hierarchy Sort
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
  
  // Sort by authority tier
  const sortedEvidence = [...data.evidence].sort((a, b) => (b.authorityTier || 0) - (a.authorityTier || 0));

  // Generate deterministic hash for cross-provider parity (EG-3)
  const contentToHash = sortedEvidence.map(e => `${e.sourceId}:${e.excerpt}`).join('|');
  const encoder = new TextEncoder();
  const rawHash = await crypto.subtle.digest("SHA-256", encoder.encode(contentToHash));
  const contextHash = Array.from(new Uint8Array(rawHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    contextPackId: `ctx-${requestId}`,
    contextHash,
    canonicalTopic,
    specialty,
    aliases: [canonicalTopic], 
    evidence: sortedEvidence,
    goldQuestions: data.goldQuestions,
    officialExamRefs: data.officialExams,
    conflicts: data.conflicts,
    retrievalConfidence: sortedEvidence.length > 2 ? 0.95 : (sortedEvidence.length > 0 ? 0.6 : 0.1),
    freshness: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

/**
 * Asserts that the context pack is isolated to the canonical topic.
 * EG-3: Sibling Blocker (Strict isolation)
 */
export function assertTopicIsolation(
  contextPack: EvidenceContextPack,
  canonicalTopic: string
): { isolated: boolean; contaminations: string[] } {
  const contaminations: string[] = [];
  const reqTopicLower = canonicalTopic.toLowerCase();

  contextPack.evidence.forEach(item => {
    const itemTopic = item.canonicalTopic.toLowerCase();
    const isAlias = contextPack.aliases.some(a => a.toLowerCase() === itemTopic);
    
    if (itemTopic !== reqTopicLower && !isAlias) {
       contaminations.push(`${item.evidenceId}: ${item.canonicalTopic}`);
    }
  });

  return {
    isolated: contaminations.length === 0,
    contaminations
  };
}

/**
 * Validates grounded output.
 * EG-3: Critical Hallucination detection + Grounding Score.
 */
export async function validateGroundedOutput(
  output: string,
  contextPack: EvidenceContextPack,
  isQuestion: boolean = false
): Promise<GroundedOutput> {
  const sentences = output.split(/[.!?]/).filter(s => s.trim().length > 20);
  
  const claims: ClinicalClaim[] = sentences.map(s => {
    const cleanSentence = s.trim().toLowerCase();
    
    const supportedSources = contextPack.evidence.filter(ev => {
      const excerpt = ev.excerpt.toLowerCase();
      const words = cleanSentence.split(' ').filter(w => w.length > 4);
      if (words.length === 0) return false;
      const matches = words.filter(w => excerpt.includes(w)).length;
      return matches >= Math.min(words.length, 3);
    });

    return {
      claim: s.trim(),
      status: supportedSources.length > 0 ? 'supported' : 'unsupported',
      evidenceIds: supportedSources.map(ss => ss.evidenceId)
    };
  });

  const supportedCount = claims.filter(c => c.status === 'supported').length;
  const unsupportedCount = claims.filter(c => c.status === 'unsupported').length;
  
  const criticalKeywords = ['dose', 'contraindicado', 'indicação', 'tratamento', 'gabarito', 'urgência', 'prognóstico'];
  const hasCriticalHallucination = claims.some(c => 
    c.status === 'unsupported' && criticalKeywords.some(kw => c.claim.toLowerCase().includes(kw))
  );

  const groundingScore = claims.length > 0 ? supportedCount / claims.length : 0;

  const score: GroundingScore = {
    overall_score: Math.round(groundingScore * 100),
    grounding_score: groundingScore,
    unsupported_claim_rate: claims.length > 0 ? unsupportedCount / claims.length : 0,
    topic_match_score: 100, // Heuristic
    critical_hallucination: hasCriticalHallucination,
    evidence_status: contextPack.evidence.length === 0 ? 'insufficient_evidence' : 
                     (groundingScore > 0.8 ? 'robust' : 'sufficient')
  };

  return {
    data: output,
    grounding: score,
    claims,
    sourceIds: [...new Set(claims.flatMap(c => c.evidenceIds))],
    answerKeySupported: isQuestion ? contextPack.evidence.some(e => ['gold_question', 'official_exam', 'guideline'].includes(e.sourceType)) : undefined
  };
}
