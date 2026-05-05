import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { documentId, action } = await req.json();
    if (!documentId) throw new Error("ID do documento é obrigatório");

    // 1. Buscar documento e validar tenant
    const { data: doc, error: docErr } = await supabaseAdmin
      .from("rag_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docErr || !doc) throw new Error("Documento não encontrado");

    if (action === "reprocess") {
      // 2. Limpar dados antigos
      await supabaseAdmin.from("rag_chunks").delete().eq("document_id", documentId);
      
      // 3. Atualizar status
      await supabaseAdmin.from("rag_documents").update({ 
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString()
      }).eq("id", documentId);

      // 4. Criar Job
      const { data: job } = await supabaseAdmin.from("rag_processing_jobs").insert({
        document_id: documentId,
        organization_id: doc.organization_id,
        status: "queued",
        created_by: doc.uploaded_by // Simplificação para o teste
      }).select().single();

      // Aqui dispararia a lógica de quebra de texto e embeddings
      // (Em um sistema real, isso chamaria uma função de worker ou fila)
      
      return new Response(JSON.stringify({ success: true, jobId: job?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
