import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, exam_key, payload } = await req.json();

    if (action === "ingest_raw") {
      // Ingestão bruta (Rolling Window)
      const { year, questions } = payload;
      
      const rawEntries = questions.map((q: any) => ({
        exam_key,
        exam_year: year,
        specialty: q.specialty,
        topic: q.topic || 'Geral',
        occurrence_count: q.count || 1
      }));

      const { error } = await supabase.from('exam_raw_data').insert(rawEntries);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: "Dados brutos ingeridos." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "reconcile") {
      // Reconciliação com Weight Smoothing
      const smoothingFactor = payload?.smoothing_factor || 0.3;
      
      const { error } = await supabase.rpc('reconcile_and_smooth_weights', { 
        p_exam_key: exam_key,
        p_smoothing_factor: smoothingFactor
      });

      if (error) throw error;

      // Criar Snapshot (Versionamento)
      const { data: fullBlueprint } = await supabase
        .from('exam_blueprints')
        .select('*')
        .eq('exam_key', exam_key)
        .eq('is_active', true);

      const versionLabel = `${exam_key.toUpperCase()}_v${new Date().toISOString().split('T')[0].replace(/-/g, '_')}`;
      
      await supabase.from('exam_blueprint_versions').insert({
        version_label: versionLabel,
        exam_key: exam_key,
        blueprint_json: fullBlueprint,
        confidence_avg: fullBlueprint.reduce((acc: number, b: any) => acc + Number(b.confidence_score), 0) / fullBlueprint.length,
        is_active: true
      });

      return new Response(JSON.stringify({ 
        success: true, 
        version: versionLabel,
        message: "Blueprint reconciliado e versionado." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
