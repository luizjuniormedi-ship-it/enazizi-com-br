import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getKnowledgeCache, extractTopic } from "./supabase/functions/_shared/knowledge-cache.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCache() {
  console.log("--- TESTANDO CACHE INTELIGENTE ---");
  
  const testTopic = "ICC";
  console.log(`Detectando tema para: "Quero saber sobre ${testTopic}"`);
  
  const topicInfo = extractTopic(`Quero saber sobre ${testTopic}`);
  console.log("Tema detectado:", topicInfo);
  
  if (topicInfo) {
    console.log("Buscando no cache...");
    const cache = await getKnowledgeCache(supabase, topicInfo.topic);
    
    if (cache) {
      console.log("✅ CACHE HIT!");
      console.log("Conteúdo encontrado:", cache.content.substring(0, 100) + "...");
      console.log("Data de atualização:", cache.match.updated_at);
      
      // Esperar um pouco para a atualização assíncrona
      await new Promise(r => setTimeout(r, 2000));
      
      const { data: updated } = await supabase
        .from("rag_knowledge_base")
        .select("access_count, last_accessed_at")
        .eq("id", cache.match.id)
        .single();
        
      console.log("Estatísticas atualizadas:", updated);
      
      if (updated.access_count > cache.match.access_count) {
        console.log("✅ INCREMENTO DE ACESSO FUNCIONOU!");
      } else {
        console.log("❌ ERRO NO INCREMENTO DE ACESSO");
      }
    } else {
      console.log("❌ CACHE MISS (Verifique se os dados de teste foram inseridos)");
    }
  }
}

testCache();
