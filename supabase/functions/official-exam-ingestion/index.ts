import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface IngestionRequest {
  action: 'discover' | 'download' | 'parse' | 'full_pipeline';
  source_id?: string;
  file_id?: string;
  metadata?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, source_id, file_id, metadata } = await req.json() as IngestionRequest;

    console.log(`[Ingestion] Action: ${action}, Source: ${source_id}`);

    // Registro da execução
    const { data: run, error: runError } = await supabaseClient
      .from('ingestion_pipeline_runs')
      .insert({
        source_id,
        run_type: action,
        status: 'running',
        started_at: new Date().toISOString(),
        stats: { start_time: new Date().toISOString() }
      })
      .select()
      .single();

    if (runError) throw runError;

    let result = {};

    if (action === 'discover') {
      // Simulação de descoberta (INEP, ESA, etc)
      result = {
        files_found: [
          { name: 'ENEM 2023 D1 AZUL', url: 'https://download.inep.gov.br/enem/provas_e_gabaritos/2023_PV_impresso_D1_CD1_AZUL.pdf' },
          { name: 'ESA 2024 PROVA', url: 'https://esa.eb.mil.br/images/provas/2024/prova_geral.pdf' }
        ]
      };
      
      await supabaseClient
        .from('ingestion_pipeline_runs')
        .update({ status: 'success', stats: { ...run.stats, ...result }, finished_at: new Date().toISOString() })
        .eq('id', run.id);

    } else if (action === 'full_pipeline') {
      // Mock de pipeline completo
      result = {
        source: 'INEP',
        file: 'ENEM_2023_D1_AZUL.pdf',
        ocr_confidence: 0.99,
        questions_extracted: 2,
        status: 'validated'
      };

      await supabaseClient
        .from('ingestion_pipeline_runs')
        .update({ status: 'success', stats: { ...run.stats, ...result }, finished_at: new Date().toISOString() })
        .eq('id', run.id);
    }

    return new Response(JSON.stringify({ success: true, result, run_id: run.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[Ingestion Error]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
