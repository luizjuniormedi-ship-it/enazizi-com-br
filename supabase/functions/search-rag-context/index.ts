import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // 1. Obter organization_id
    const { data: profile } = await supabaseAdmin.from("profiles").select("organization_id").eq("user_id", user.id).single();
    const orgId = profile?.organization_id;

    // 2. Gerar embedding para a query (Simulado para o teste, em prod usaria OpenAI)
    // const embedding = await generateEmbedding(query);
    
    // 3. Buscar chunks relevantes (Busca por texto simples por enquanto como fallback de infra)
    let dbQuery = supabaseAdmin
      .from("rag_chunks")
      .select(`
        content, 
        page_number, 
        document_id,
        rag_documents!inner(title, file_name, is_published)
      `)
      .eq("organization_id", orgId)
      .eq("rag_documents.is_published", true)
      .limit(3);

    if (topic) dbQuery = dbQuery.ilike("content", `%${topic}%`);
    
    const { data: chunks, error: searchErr } = await dbQuery;
    if (searchErr) console.error("RAG Search Error:", searchErr);

    // 4. Formatar contexto bibliográfico
    const bibliography = (chunks || []).map(c => ({
      content: c.content,
      source: (c.rag_documents as any)?.title || (c.rag_documents as any)?.file_name,
      page: c.page_number
    }));

    return new Response(JSON.stringify({ 
      success: true, 
      bibliography,
      has_context: bibliography.length > 0 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
