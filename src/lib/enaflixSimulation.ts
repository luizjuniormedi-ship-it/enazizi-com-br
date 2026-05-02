import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Script de Simulação ENAFLIX para testes de geração automática.
 * Simula um comportamento real de estudo pesado para disparar a engine.
 */
export const simulateHighStudyActivity = async (userId: string, topic: string) => {
  console.log(`[ENAFLIX Sim] Iniciando simulação de estudo pesado para ${topic}...`);
  
  try {
    // 1. Simular rastreamento de alta intensidade (múltiplas interações, erros e tempo)
    const { error: trackErr } = await supabase
      .from("tutor_study_tracking")
      .upsert({
        user_id: userId,
        topic: topic,
        subject: "Clínica Médica",
        interaction_count: 25,
        total_study_time: 1800, // 30 min
        flashcards_generated: 8,
        questions_answered: 15,
        related_errors: 6, // Score garantido > 85
        last_interaction_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic' });

    if (trackErr) throw trackErr;

    // 2. Disparar a Edge Function de geração
    const { data, error } = await supabase.functions.invoke("generate-lesson-from-real-study", {
      body: { 
        user_id: userId, 
        topic: topic,
        force: true // Forçar para ignorar rollout se necessário
      }
    });

    if (error) throw error;

    if (data?.status === "success") {
      toast.success(`Simulação Concluída: Aula de "${topic}" enviada para produção!`);
      return data.lesson_id;
    } else {
      toast.info(`Status da Simulação: ${data?.reason || "Verifique os logs"}`);
    }
  } catch (err) {
    console.error("Erro na simulação:", err);
    toast.error("Falha ao rodar simulação de estudo.");
  }
};
