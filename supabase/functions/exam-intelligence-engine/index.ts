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

    if (action === "reconcile" || action === "preview_reconcile") {
      const smoothingFactor = payload?.smoothing_factor || 0.3;
      
      // Se for apenas preview, calculamos mas não persistimos na exam_blueprints
      if (action === "preview_reconcile") {
        const { data: current } = await supabase
          .from('exam_blueprints')
          .select('specialty, topic, weight, confidence_score, sample_size')
          .eq('exam_key', exam_key)
          .eq('is_active', true);

        const { data: raw } = await supabase
          .from('exam_raw_data')
          .select('specialty, topic, occurrence_count')
          .eq('exam_key', exam_key);

        const totalRaw = raw?.reduce((acc: number, r: any) => acc + r.occurrence_count, 0) || 1;
        
        const preview = raw?.map((r: any) => {
          const calculatedWeight = (r.occurrence_count / totalRaw) * 100;
          const currentTopic = current?.find((c: any) => c.specialty === r.specialty && c.topic === r.topic);
          const oldWeight = currentTopic?.weight || 0;
          const newWeight = (calculatedWeight * smoothingFactor) + (oldWeight * (1 - smoothingFactor));
          
          return {
            specialty: r.specialty,
            topic: r.topic,
            old_weight: oldWeight,
            new_weight: newWeight,
            delta: newWeight - oldWeight,
            severity: Math.abs(newWeight - oldWeight) >= 5 ? 'high' : 'low'
          };
        });

        return new Response(JSON.stringify({ 
          success: true, 
          preview,
          confidence_expected: Math.min(1.0, 0.5 + (totalRaw / 1000.0)),
          sample_size: totalRaw
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fluxo real de reconciliação
      const { error } = await supabase.rpc('reconcile_and_smooth_weights', { 
        p_exam_key: exam_key,
        p_smoothing_factor: smoothingFactor
      });

      if (error) throw error;

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
        confidence_avg: fullBlueprint.reduce((acc: number, b: any) => acc + Number(b.confidence_score), 0) / (fullBlueprint.length || 1),
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
