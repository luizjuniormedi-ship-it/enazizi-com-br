
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface MemoryContext {
  previous_mastery: string;
  known_misconceptions: string[];
  effective_analogies: string[];
  weak_topics: string[];
  retention_risk: number;
  prior_blocks_summary: string;
  cognitive_pattern: string;
  cached_blocks: any[];
}

export async function buildPedagogicalContext(
  supabase: SupabaseClient,
  userId: string,
  topic: string
): Promise<MemoryContext> {
  // Hardening: protect against missing inputs
  if (!userId) throw new Error("userId is required to build pedagogical context");

  // 1. Fetch relevant learning memory blocks
  const { data: blocks } = await supabase
    .from("tutor_lesson_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("topic", topic)
    .order("created_at", { ascending: false })
    .limit(5);

  // 2. Fetch session summaries
  const { data: summaries } = await supabase
    .from("tutor_session_summary")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  // 3. Fetch effective analogies
  const { data: analogies } = await supabase
    .from("tutor_analogy_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("topic", topic)
    .gt("efficacy_score", 0.7)
    .limit(3);

  // 4. Synthesize context
  const known_misconceptions = Array.from(new Set(
    (summaries || []).flatMap(s => s.misconceptions_identified || [])
  ));

  const effective_analogies = (analogies || []).map(a => a.analogy);
  
  const prior_blocks_summary = (blocks || [])
    .map(b => `- ${b.title}: ${b.summary || ''}`)
    .join("\n");

  return {
    previous_mastery: "initial",
    known_misconceptions,
    effective_analogies,
    weak_topics: (summaries || []).flatMap(s => s.concepts_fragile || []),
    retention_risk: 0.2, 
    prior_blocks_summary,
    cognitive_pattern: "Visual/Logístico", 
    cached_blocks: blocks || []
  };
}

export async function saveTutorMemory(
  supabase: SupabaseClient,
  userId: string,
  params: {
    topic: string;
    subtopic?: string;
    content: string;
    sessionId?: string | null;
  }
) {
  if (!userId || !params.topic || !params.content) {
    console.warn("[saveTutorMemory] Missing required fields", { userId, topic: params.topic });
    return null;
  }

  const titleMatch = params.content.match(/## 🎯 BLOCO \d+ — (.*)/) || params.content.match(/# (.*)/) || params.content.match(/1\. (.*)/);
  const title = titleMatch ? titleMatch[1].substring(0, 100) : "Bloco Pedagógico";

  // Validate session presence to avoid FK violation
  let sourceSessionId: string | null = null;
  if (params.sessionId) {
    try {
      const { data: sess } = await supabase
        .from("tutor_sessions")
        .select("id")
        .eq("id", params.sessionId)
        .maybeSingle();
      if (sess) sourceSessionId = params.sessionId;
    } catch (e) {
      console.error("[saveTutorMemory] Session check error", e);
    }
  }

  // Resilient persistence: upsert by (user_id, topic)
  const { data: memory, error } = await supabase
    .from("tutor_lesson_memory")
    .upsert({
      user_id: userId,
      source_session_id: sourceSessionId,
      topic: params.topic,
      subtopic: params.subtopic,
      title: title,
      summary: params.content.substring(0, 500) + "...",
      structured_content: { content: params.content },
      status: 'published',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,topic',
      ignoreDuplicates: false,
    })
    .select()
    .maybeSingle();

  if (error) {
    // Critical: non-blocking log
    console.error("[saveTutorMemory] Persistence error:", error.message, error.details);
  }
  return memory;
}
