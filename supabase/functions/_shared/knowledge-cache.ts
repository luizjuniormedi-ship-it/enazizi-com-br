import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function getKnowledgeCache(supabase: any, topic: string) {
  if (!topic || topic.length < 2) return null;

  try {
    const { data, error } = await supabase
      .from("rag_knowledge_base")
      .select("*")
      .or(`topic.ilike.%${topic}%,specialty.ilike.%${topic}%`)
      .order("updated_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("[KNOWLEDGE_CACHE_FETCH_ERROR]", error);
      return null;
    }

    if (data && data.length > 0) {
      const bestMatch = data[0];
      
      // Update access stats asynchronously
      const isOutdated = new Date(bestMatch.updated_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      supabase
        .from("rag_knowledge_base")
        .update({
          access_count: (bestMatch.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", bestMatch.id)
        .then(({ error: updateError }: any) => {
          if (updateError) console.warn("[KNOWLEDGE_CACHE_UPDATE_STATS_ERROR]", updateError);
        });

      return {
        content: data.map((d: any) => d.content).join("\n\n---\n\n"),
        isOutdated,
        match: bestMatch
      };
    }
  } catch (err) {
    console.error("[KNOWLEDGE_CACHE_ERROR]", err);
  }
  return null;
}

export async function saveKnowledgeCache(
  supabase: any,
  topic: string,
  specialty: string,
  content: string,
  source = "tutor-auto-cache"
) {
  try {
    const { error } = await supabase.from("rag_knowledge_base").insert({
      topic,
      specialty,
      content,
      source,
      token_count: content.length,
    });

    if (error) console.error("[KNOWLEDGE_CACHE_SAVE_ERROR]", error);
  } catch (err) {
    console.error("[KNOWLEDGE_CACHE_SAVE_FATAL]", err);
  }
}

export function extractTopic(text: string): { topic: string; specialty: string } | null {
  const lower = text.toLowerCase();
  
  const rules = [
    { regex: /icc|insufici[eê]ncia card[ií]aca/i, topic: "ICC", specialty: "Cardiologia" },
    { regex: /dpoc|doen[çc]a pulmonar obstrutiva cr[ôo]nica/i, topic: "DPOC", specialty: "Pneumologia" },
    { regex: /has|hipertens[ãa]o arterial/i, topic: "HAS", specialty: "Cardiologia" },
    { regex: /iam|infarto|dor tor[áa]cica/i, topic: "IAM", specialty: "Cardiologia" },
    { regex: /diabetes|dm1|dm2/i, topic: "Diabetes", specialty: "Endocrinologia" },
    { regex: /sepse|choque s[eé]ptico/i, topic: "Sepse", specialty: "Infectologia" },
    { regex: /asma/i, topic: "Asma", specialty: "Pneumologia" },
    { regex: /pve|perda de consci[êê]ncia|desmaio/i, topic: "PVE", specialty: "Neurologia" },
    { regex: /avc|acidente vascular cerebral/i, topic: "AVC", specialty: "Neurologia" },
    { regex: /hiv|aids/i, topic: "HIV", specialty: "Infectologia" },
  ];

  for (const rule of rules) {
    if (rule.regex.test(lower)) {
      return { topic: rule.topic, specialty: rule.specialty };
    }
  }

  return null;
}
