import { supabase } from "@/integrations/supabase/client";

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

/**
 * EducationalInterestEngine — Cliente para rastreamento de estudo e detecção de aulas.
 */
export const trackStudyActivity = async (data: TrackingUpdate) => {
  try {
    // 1. Atualizar ou inserir rastreamento de estudo
    const { data: existing, error: fetchErr } = await supabase
      .from("tutor_study_tracking")
      .select("*")
      .eq("user_id", data.userId)
      .eq("topic", data.topic)
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
        user_id: data.userId,
        topic: data.topic,
        subject: data.subject || "Medicina",
        interaction_count: data.interactionCount || 1,
        total_study_time: data.studyTimeSeconds || 0,
        flashcards_generated: data.flashcardsCount || 0,
        questions_answered: data.questionsCount || 0,
        fsrs_reviews: data.fsrsCount || 0,
        related_errors: data.errorsCount || 0,
      });
    }

    // 2. Chamar a Edge Function para verificar se deve gerar aula
    // Fazemos isso em background (não esperamos a resposta para não travar a UI)
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lesson-from-real-study`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: data.userId,
        topic: data.topic
      }),
    }).catch(err => console.error("Error triggering auto-lesson detection:", err));

  } catch (error) {
    console.error("Error tracking study activity:", error);
  }
};
