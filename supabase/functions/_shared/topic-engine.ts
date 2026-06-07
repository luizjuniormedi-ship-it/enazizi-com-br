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
        
        // Map subtopics (aliases) back to canonical for competency matching
        this.competencies.set(item.alias.toLowerCase(), item.canonical_topic);
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
    // Exact mode logic
    const hasSubtopics = requestedSubtopics.length > 0;
    const hasSpecificTopic = requestedTopics.some(t => this.isSpecificTopic(t));
    const exactTopicMode = hasSubtopics || hasSpecificTopic;
    
    if (exactTopicMode) {
      console.log(`[SIM_EXACT_TOPIC_MODE] active=true | reason=${hasSubtopics ? 'has_subtopics' : 'specific_topic'}`);
    }

    const qTopic = (question.topic || "").toLowerCase();
    const qSubtopic = (question.subtopic || "").toLowerCase();
    const qTheme = (question.curriculum_theme || "").toLowerCase();
    const qSubtheme = (question.curriculum_subtheme || "").toLowerCase();
    const qCompetency = (question.curriculum_competency || "").toLowerCase();

    let maxScore = 0;
    let matchType: TopicMatchResult['matchType'] = "invalid";
    let bestCanonical: string | null = null;

    // 1. Competency/Subtopic Match (Highest Priority: 100 points)
    if (hasSubtopics) {
      for (const sub of requestedSubtopics) {
        const subLower = sub.toLowerCase();
        // Exact match in curriculum_competency or subtopic fields
        const isExactMatch = [qCompetency, qSubtopic, qSubtheme].some(val => val === subLower);
        
        if (isExactMatch) {
          console.log(`[SIM_TOPIC_MATCH_SCORE] question_id=${question.id} score=100 type=exact (competency)`);
          return { score: 100, canonicalTopic: this.competencies.get(subLower) || null, matchType: "exact", exactTopicMode };
        }
      }
    }

    // 2. Canonical/Alias Match (90-100 points)
    const requestedTerms = [...requestedSubtopics, ...requestedTopics];
    for (const term of requestedTerms) {
      const canonical = this.identifyCanonical(term);
      const termLower = term.toLowerCase();

      if (canonical) {
        const aliases = this.aliases.get(canonical) || [];
        const isExact = [qTopic, qSubtopic, qTheme, qSubtheme].some(val => val === termLower || val === canonical.toLowerCase());
        const isAlias = !isExact && aliases.includes(qTopic) || aliases.includes(qSubtopic) || aliases.includes(qTheme) || aliases.includes(qSubtheme);

        if (isExact || isAlias) {
          const score = isExact ? 100 : 90;
          if (score > maxScore) {
            maxScore = score;
            matchType = isExact ? "exact" : "alias";
            bestCanonical = canonical;
          }
        }

        // 3. Sibling Topic Blocker (CRITICAL)
        const blocked = this.siblingBlocks.get(canonical) || [];
        const isSibling = blocked.some(b => 
          [qTopic, qSubtopic, qTheme, qSubtheme].some(val => val.includes(b.toLowerCase()))
        );
        
        if (isSibling) {
          console.log(`[SIM_TOPIC_SIBLING_BLOCKED] question_id=${question.id} term=${term} canonical=${canonical} question_topics=${qTopic}/${qSubtopic}`);
          return { score: 0, canonicalTopic: canonical, matchType: "invalid", exactTopicMode };
        }
      } else {
        // Fallback for non-canonical terms (e.g., broad categories)
        const isMatch = [qTopic, qSubtopic, qTheme, qSubtheme].some(val => val.includes(termLower));
        if (isMatch) {
          if (70 > maxScore) {
            maxScore = 70;
            matchType = "parent";
          }
        }
      }
    }

    // 4. Parent Fallback Blocker (CRITICAL)
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
