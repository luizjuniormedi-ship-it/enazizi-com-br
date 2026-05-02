import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * EducationalInterestEngine — Cliente para rastreamento de estudo e detecção de aulas.
 * VERSÃO 2.0: Integração total com Tutor, Questões, FSRS e Banco de Erros.
 */

interface TrackingUpdate {
  userId: string;
  topic: string;
  subject?: string;
  interactionCount?: number;
  studyTimeSeconds?: number;
  flashcardsCount?: number;
  questionsCount?: number;
  fsrsCount?: number;
  errorsCount?: number;
}

export const trackStudyActivity = async (data: TrackingUpdate) => {
  try {
    const { userId, topic } = data;
    if (!userId || !topic) return;

    // 1. Buscar registro atual para acumular
    const { data: existing, error: fetchErr } = await supabase
      .from("tutor_study_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("topic", topic)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (existing) {
      await supabase
        .from("tutor_study_tracking")
        .update({
          interaction_count: (existing.interaction_count || 0) + (data.interactionCount || 0),
          total_study_time: (existing.total_study_time || 0) + (data.studyTimeSeconds || 0),
          flashcards_generated: (existing.flashcards_generated || 0) + (data.flashcardsCount || 0),
          questions_answered: (existing.questions_answered || 0) + (data.questionsCount || 0),
          fsrs_reviews: (existing.fsrs_reviews || 0) + (data.fsrsCount || 0),
          related_errors: (existing.related_errors || 0) + (data.errorsCount || 0),
          last_interaction_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("tutor_study_tracking").insert({
        user_id: userId,
        topic: topic,
        subject: data.subject || "Medicina",
        interaction_count: data.interactionCount || 0,
        total_study_time: data.studyTimeSeconds || 0,
        flashcards_generated: data.flashcardsCount || 0,
        questions_answered: data.questionsCount || 0,
        fsrs_reviews: data.fsrsCount || 0,
        related_errors: data.errorsCount || 0,
      });
    }

    // 2. Notificar a Edge Function para reavaliar score e possível geração de aula
    // Usamos invocação silenciosa para não impactar performance do usuário
    supabase.functions.invoke("generate-lesson-from-real-study", {
      body: { user_id: userId, topic: topic }
    }).catch(err => console.error("Auto-lesson detection trigger failed (silent):", err));

  } catch (error) {
    console.error("Error tracking study activity:", error);
  }
};

/**
 * Dispara uma geração manual forçada para administradores
 */
export const forceAutoLessonGeneration = async (userId: string, topic: string) => {
  try {
    const { data, error } = await supabase.functions.invoke("generate-lesson-from-real-study", {
      body: { user_id: userId, topic: topic, force: true }
    });

    if (error) throw error;
    
    if (data?.status === "success") {
      toast.success(`Aula de "${topic}" enviada para a Central de Produção!`);
      return data.lesson_id;
    } else if (data?.reason === "already_exists") {
      toast.info(`Já existe uma aula de "${topic}" em produção.`);
    } else {
      toast.error(`Falha ao gerar: ${data?.reason || "Erro desconhecido"}`);
    }
  } catch (error) {
    console.error("Error forcing lesson generation:", error);
    toast.error("Erro ao solicitar geração automática.");
  }
};
