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
  
  // Transformar array de {specialty, topic, weight} em Record<string, number>
  // Priorizando a soma por especialidade se houver múltiplos tópicos
  const specialtyWeights: Record<string, number> = {};
  data.forEach((item: any) => {
    specialtyWeights[item.specialty] = (specialtyWeights[item.specialty] || 0) + Number(item.weight);
  });

  return {
    specialtyWeights,
    rawBlueprint: data // Mantém os tópicos granulares para uso futuro
  };
}
