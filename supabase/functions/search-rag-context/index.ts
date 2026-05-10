import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createEmbedding } from "../_shared/ai-embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  console.log(`[search-rag-context] REQUEST_RECEIVED id=${requestId}`);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    
    if (authErr || !user) throw new Error("Não autorizado");

    const { query, topic } = await req.json();
    if (!query) throw new Error("Query é obrigatória");

    console.log(`[search-rag-context] STARTING_SEARCH id=${requestId} query=${query.slice(0, 50)}`);

    // 1. Generate embedding
    let embedding;
    try {
      embedding = await createEmbedding(query);
      console.log(`[search-rag-context] EMBEDDING_GENERATED id=${requestId}`);
    } catch (e) {
      console.error(`[search-rag-context] EMBEDDING_FAILED id=${requestId}`, e);
      // Fallback to empty context if embedding fails
      return new Response(JSON.stringify({ 
        success: false, 
        error: "embedding_failed",
        bibliography: [],
        has_context: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Vector search using RPC
    const { data: chunks, error: searchErr } = await supabaseAdmin.rpc("match_rag_chunks", {
      query_embedding: embedding,
      match_threshold: 0.3, // Lower threshold for better recall during diagnosis
      match_count: 5
    });

    if (searchErr) {
      console.error(`[search-rag-context] RPC_ERROR id=${requestId}`, searchErr);
      throw searchErr;
    }

    // 3. Fetch document titles for better sources
    // (Join in RPC is better but let's stick to what we have or do a quick follow up if needed)
    // Actually, match_rag_chunks returns document_id.
    
    const bibliography = (chunks || []).map((c: any) => ({
      content: c.content,
      source: "Base de Conhecimento", // Generic for now, can be improved
      page: null,
      similarity: c.similarity,
      document_id: c.document_id
    }));

    console.log(`[search-rag-context] SEARCH_COMPLETED id=${requestId} count=${bibliography.length}`);

    return new Response(JSON.stringify({ 
      success: true, 
      bibliography,
      has_context: bibliography.length > 0,
      requestId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error(`[search-rag-context] FATAL_ERROR id=${requestId}`, e);
    return new Response(JSON.stringify({ error: e.message, success: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
