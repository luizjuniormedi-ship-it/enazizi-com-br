import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface TopicMatchResult {
  score: number;
  canonicalTopic: string | null;
  matchType: "exact" | "alias" | "parent" | "related" | "invalid";
  exactTopicMode: boolean;
}

/**
 * P0 EXACT TOPIC ENGINE
 */
export class TopicEngine {
  private supabase: SupabaseClient;
  private aliases: Map<string, string[]> = new Map();
  private siblingBlocks: Map<string, string[]> = new Map();
  private competencies: Map<string, string> = new Map(); // subtopic -> canonical_topic

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    // Initial known sibling blocks (Hardcoded for high-priority cases)
    this.siblingBlocks.set('IAM', ['Pericardite', 'Miocardite', 'Endocardite', 'Insuficiência Cardíaca', 'Arritmias', 'Valvopatias', 'Cardiopatias Congênitas', 'IC']);
    this.siblingBlocks.set('Pericardite', ['IAM', 'Miocardite', 'Endocardite', 'Insuficiência Cardíaca', 'Arritmias', 'Valvopatias', 'SCA', 'IC']);
    this.siblingBlocks.set('CAD Pediátrica', ['DM2', 'Hipoglicemia', 'HAS', 'Obesidade', 'Diabetes Mellitus Tipo 2']);
  }

  async loadAliases(topics: string[], subtopics: string[]) {
    const allSearchTerms = [...topics, ...subtopics];
    if (allSearchTerms.length === 0) return;

    console.log(`[SIM_TOPIC_FILTER_RECEIVED] topics=${topics.join(",")} subtopics=${subtopics.join(",")}`);

    const { data } = await this.supabase
      .from('topic_aliases')
      .select('canonical_topic, alias')
      .eq('active', true);

    if (data) {
      for (const item of data) {
        const list = this.aliases.get(item.canonical_topic) || [];
        list.push(item.alias.toLowerCase());
        this.aliases.set(item.canonical_topic, list);
      }
    }
  }

  identifyCanonical(term: string): string | null {
    const termLower = term.toLowerCase();
    for (const [canonical, aliases] of this.aliases.entries()) {
      if (canonical.toLowerCase() === termLower || aliases.includes(termLower)) {
        console.log(`[SIM_CANONICAL_TOPIC_IDENTIFIED] term=${term} canonical=${canonical}`);
        return canonical;
      }
    }
    return null;
  }

  calculateScore(question: any, requestedTopics: string[], requestedSubtopics: string[]): TopicMatchResult {
    const exactTopicMode = requestedSubtopics.length > 0 || requestedTopics.some(t => this.isSpecificTopic(t));
    
    if (exactTopicMode) {
      console.log(`[SIM_EXACT_TOPIC_MODE] active=true`);
    }

    const qTopic = (question.topic || "").toLowerCase();
    const qSubtopic = (question.subtopic || "").toLowerCase();
    const qTheme = (question.curriculum_theme || "").toLowerCase();
    const qSubtheme = (question.curriculum_subtheme || "").toLowerCase();

    let maxScore = 0;
    let matchType: TopicMatchResult['matchType'] = "invalid";
    let bestCanonical: string | null = null;

    const requestedTerms = [...requestedSubtopics, ...requestedTopics];

    for (const term of requestedTerms) {
      const canonical = this.identifyCanonical(term);
      const termLower = term.toLowerCase();

      // check exact or alias
      if (canonical) {
        const aliases = this.aliases.get(canonical) || [];
        const isMatch = [qTopic, qSubtopic, qTheme, qSubtheme].some(val => 
          val === termLower || 
          val === canonical.toLowerCase() ||
          aliases.includes(val)
        );

        if (isMatch) {
          const score = (qTopic === termLower || qSubtopic === termLower) ? 100 : 90;
          if (score > maxScore) {
            maxScore = score;
            matchType = score === 100 ? "exact" : "alias";
            bestCanonical = canonical;
          }
        }

        // Sibling blocking
        const blocked = this.siblingBlocks.get(canonical) || [];
        const isSibling = blocked.some(b => 
          [qTopic, qSubtopic, qTheme, qSubtheme].some(val => val.includes(b.toLowerCase()))
        );
        
        if (isSibling) {
          console.log(`[SIM_TOPIC_SIBLING_BLOCKED] question_id=${question.id} term=${term} canonical=${canonical} question_topics=${qTopic}/${qSubtopic}`);
          return { score: 0, canonicalTopic: canonical, matchType: "invalid", exactTopicMode };
        }
      } else {
        // Fallback score for non-canonical terms
        const isMatch = [qTopic, qSubtopic, qTheme, qSubtheme].some(val => val.includes(termLower));
        if (isMatch) {
          maxScore = 70;
          matchType = "parent";
        }
      }
    }

    // Block parent fallback if exactTopicMode and score < 90
    if (exactTopicMode && maxScore < 90 && maxScore > 0) {
      console.log(`[SIM_PARENT_FALLBACK_BLOCKED] question_id=${question.id} score=${maxScore}`);
      maxScore = 0;
      matchType = "invalid";
    }

    if (maxScore > 0) {
      console.log(`[SIM_TOPIC_MATCH_SCORE] question_id=${question.id} score=${maxScore} type=${matchType}`);
    }

    return { score: maxScore, canonicalTopic: bestCanonical, matchType, exactTopicMode };
  }

  private isSpecificTopic(topic: string): boolean {
    // List of high-priority specific topics that trigger exact mode even if not in subtopics
    const specifics = ['IAM', 'Pericardite', 'CAD Pediátrica', 'SCA', 'STEMI', 'NSTEMI'];
    return specifics.some(s => topic.toLowerCase().includes(s.toLowerCase()));
  }
}
