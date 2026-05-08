import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export async function fetchDynamicBlueprint(supabase: any, examKey: string, useEffectiveWeight = true) {
  console.log(`[Blueprint] Buscando blueprint dinâmico para: ${examKey}`);
  
  const { data, error } = await supabase
    .rpc('get_active_blueprint', { p_exam_key: examKey });

  if (error) {
    console.error("[Blueprint] Erro ao buscar blueprint dinâmico:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log(`[Blueprint] Nenhum blueprint dinâmico encontrado para ${examKey}. Usando fallback estático.`);
    return null;
  }

  console.log(`[Blueprint] Blueprint dinâmico encontrado para ${examKey} (${data.length} registros)`);
  
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
