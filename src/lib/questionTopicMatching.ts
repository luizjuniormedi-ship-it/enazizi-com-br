/**
 * questionTopicMatching — Helper puro de matching textual entre questões e
 * a hierarquia curricular (specialty → topic → subtopic → microtopic).
 *
 * Usado pelo backfill inicial de `question_topic_links` e reutilizável por
 * futuras camadas (IA, classificação manual, importação).
 *
 * REGRAS DE OURO (defensivas):
 * - "Melhor menos links confiáveis do que muitos links ruins"
 * - Nunca emite link com confiança < MIN_CONFIDENCE
 * - Match por specialty isolado NUNCA vira link forte (ruído)
 */

export type MatchMethod = "text" | "ai" | "manual" | "imported";
export type MatchTier = "strong" | "medium" | "weak" | "none";

export interface CurriculumNode {
  subtopic_id: string;
  subtopic_nome: string;
  topic_id: string;
  topic_nome: string;
  specialty_id: string;
  specialty_nome: string;
}

export interface QuestionInput {
  topic?: string | null;
  subtopic?: string | null;
  specialty?: string | null;
}

export interface MatchCandidate {
  subtopic_id: string;
  confidence: number; // 0..1
  tier: MatchTier;
  rule: string;
  method: MatchMethod;
}

export const MIN_CONFIDENCE = 0.6;

/** Normaliza texto: lowercase, trim, remove acentos e pontuação solta. */
export function normalize(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?()[\]{}"']/g, "");
}

/** Compara dois textos normalizados, retorna true se igual. */
export function textEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  return na.length > 0 && na === nb;
}

/** True se um texto contém o outro como substring (após normalização). */
export function textContains(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const h = normalize(haystack);
  const n = normalize(needle);
  return n.length >= 4 && h.includes(n);
}

/**
 * Encontra candidatos para uma questão dentro do conjunto de nós curriculares.
 * Retorna ordenados por confiança decrescente, sem duplicar subtopic_id.
 */
export function findMatches(question: QuestionInput, nodes: CurriculumNode[]): MatchCandidate[] {
  const found = new Map<string, MatchCandidate>();
  const upsert = (cand: MatchCandidate) => {
    const existing = found.get(cand.subtopic_id);
    if (!existing || cand.confidence > existing.confidence) found.set(cand.subtopic_id, cand);
  };

  for (const node of nodes) {
    // STRONG: subtopic.nome ≡ question.subtopic
    if (textEquals(node.subtopic_nome, question.subtopic)) {
      upsert({ subtopic_id: node.subtopic_id, confidence: 0.95, tier: "strong", rule: "subtopic-exact", method: "text" });
      continue;
    }
    // STRONG: subtopic.nome ≡ question.topic (questão referida pelo subtema diretamente)
    if (textEquals(node.subtopic_nome, question.topic)) {
      upsert({ subtopic_id: node.subtopic_id, confidence: 0.9, tier: "strong", rule: "subtopic-as-topic", method: "text" });
      continue;
    }
    // MEDIUM: topic.nome ≡ question.topic (vincula todos subtopics do topic)
    if (textEquals(node.topic_nome, question.topic)) {
      upsert({ subtopic_id: node.subtopic_id, confidence: 0.65, tier: "medium", rule: "topic-exact", method: "text" });
      continue;
    }
    // WEAK: subtopic.nome contém ou está contido em question.subtopic/topic
    if (
      question.subtopic && textContains(question.subtopic, node.subtopic_nome) ||
      question.topic && textContains(question.topic, node.subtopic_nome)
    ) {
      upsert({ subtopic_id: node.subtopic_id, confidence: 0.55, tier: "weak", rule: "subtopic-substring", method: "text" });
      continue;
    }
  }

  return Array.from(found.values())
    .filter((c) => c.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Decide se um candidato é "promovível" a link real (será inserido).
 * Política conservadora: só strong+medium passam.
 */
export function isPromotable(candidate: MatchCandidate): boolean {
  return candidate.tier === "strong" || candidate.tier === "medium";
}

/** Mapeia importance_level numérico (peso 1-10) para o enum textual. */
export function importanceFromPeso(peso: number): "muito_cobrado" | "cobrado" | "pouco_cobrado" | "raro" {
  if (peso >= 9) return "muito_cobrado";
  if (peso >= 7) return "cobrado";
  if (peso >= 5) return "pouco_cobrado";
  return "raro";
}
