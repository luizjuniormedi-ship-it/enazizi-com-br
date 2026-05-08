import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export async function fetchDynamicBlueprint(supabase: any, examKey: string, useEffectiveWeight = true) {
  console.log(`[Blueprint] Buscando blueprint dinâmico para: ${examKey}`);
  
  const { data, error } = await supabase
    .from('exam_blueprints')
    .select('specialty, topic, weight, confidence_score, effective_weight')
    .eq('exam_key', examKey)
    .eq('is_active', true)
    .order('weight', { ascending: false });

  if (error) {
    console.error("[Blueprint] Erro ao buscar blueprint dinâmico:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log(`[Blueprint] Nenhum blueprint dinâmico encontrado para ${examKey}. Usando fallback estático.`);
    return null;
  }

  console.log(`[Blueprint] Blueprint dinâmico encontrado para ${examKey} (${data.length} registros). Usando peso efetivo: ${useEffectiveWeight}`);
  
  // Transformar em Record<string, number>
  const specialtyWeights: Record<string, number> = {};
  data.forEach((item: any) => {
    const finalWeight = useEffectiveWeight ? Number(item.effective_weight || item.weight) : Number(item.weight);
    specialtyWeights[item.specialty] = (specialtyWeights[item.specialty] || 0) + finalWeight;
  });

  return {
    specialtyWeights,
    rawBlueprint: data // Mantém os tópicos granulares para uso futuro
  };
}
