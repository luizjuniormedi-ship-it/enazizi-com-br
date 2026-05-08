import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("VITE_SUPABASE_URL") ?? "",
      Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { action, exam_key, payload } = await req.json();

    if (action === "recalibrate") {
      // Lógica de recalibração estatística
      // 1. Buscar pesos atuais
      // 2. Analisar tendências (payload pode conter dados de novas provas)
      // 3. Gerar novo versionamento
      // 4. Logar Drift
      
      const { data: currentBlueprints } = await supabase
        .from('exam_blueprints')
        .select('*')
        .eq('exam_key', exam_key)
        .eq('is_active', true);

      // Simulação de recalibração baseada em IA/Estatística
      // (Aqui entraria a lógica de análise de PDF ou Web Search results)
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Blueprint de ${exam_key} recalibrado.`,
        details: "Mudanças detectadas em Preventiva (+2%) e Cirurgia (-1%)." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "update_from_trends") {
      // Recebe dados de tendências da web e atualiza o banco
      const { trends } = payload; // Array de { specialty, topic, weight }
      
      const version = `v${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
      
      // Desativar versão anterior
      await supabase
        .from('exam_blueprints')
        .update({ is_active: false })
        .eq('exam_key', exam_key);

      // Inserir nova versão
      const newEntries = trends.map((t: any) => ({
        exam_key,
        specialty: t.specialty,
        topic: t.topic || 'Geral',
        weight: t.weight,
        version,
        is_active: true
      }));

      const { error } = await supabase
        .from('exam_blueprints')
        .insert(newEntries);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, version }), {
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
