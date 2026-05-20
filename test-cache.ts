import { createClient } from "@supabase/supabase-js";
import { getKnowledgeCache, extractTopic } from "./supabase/functions/_shared/knowledge-cache.ts";

async function testCache() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  console.log("Supabase URL:", supabaseUrl);
  console.log("Supabase Key defined:", !!supabaseKey);

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log("--- TESTANDO CACHE INTELIGENTE ---");
  const testTopic = "ICC";
  const topicInfo = extractTopic(`Quero saber sobre ${testTopic}`);
  console.log("Tema detectado:", topicInfo);
  
  if (topicInfo) {
    console.log("Buscando no cache...");
    const cache = await getKnowledgeCache(supabase, topicInfo.topic);
    
    if (cache) {
      console.log("✅ CACHE HIT!");
      console.log("Conteúdo encontrado:", cache.content.substring(0, 100) + "...");
    } else {
      console.log("❌ CACHE MISS");
    }
  }
}

testCache();
