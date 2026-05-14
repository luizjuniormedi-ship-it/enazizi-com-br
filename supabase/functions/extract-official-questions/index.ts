import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get file details
    const { data: file, error: fileError } = await supabase
      .from("official_exam_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      throw new Error("Arquivo não encontrado");
    }

    // 2. Fetch file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("official-exams")
      .download(file.storage_path!);

    if (downloadError) {
      throw new Error("Erro ao baixar arquivo do storage");
    }

    // 3. Process with AI (Mocking for now)
    const mockQuestions = [
      {
        question_number: 1,
        enunciado: "Qual a conduta inicial frente a um paciente com dor precordial súbita e supra de ST?",
        alternativas: { A: "AAS e Clopidogrel", B: "Encaminhar para Hemodinâmica", C: "Oxigênio apenas", D: "Observação" },
        resposta: "B",
        specialty: "Cardiologia",
        difficulty: "Média"
      }
    ];

    for (const q of mockQuestions) {
      await supabase.from('official_exam_questions').insert({
        file_id: fileId,
        ...q,
        status: 'pending_review'
      });
    }

    // 4. Update file status
    await supabase.from('official_exam_files').update({ status: 'extracted' }).eq('id', fileId);

    return new Response(JSON.stringify({ success: true, count: mockQuestions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
