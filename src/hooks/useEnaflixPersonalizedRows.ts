import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useStudyNext } from "./useStudyNext";
import { useStudentActivePlan } from "./useStudentActivePlan";

export interface EnaflixFlashcardRowData {
  totalDue: number;
  mainTopic: string;
  urgency: "baixa" | "media" | "alta";
}

export interface EnaflixDailyPlanRowData {
  tasks: string[];
  estimatedMinutes: number;
  progressPercent: number;
  nextAction: string;
}

export interface EnaflixTutorMissionRowData {
  missionTitle: string;
  justification: string;
  criticalTopic: string;
  missionId: string;
}

export interface EnaflixHighYieldRowData {
  topic: string;
  exam: string;
  frequencyScore: number;
  userPerformance: number;
}

export function useEnaflixPersonalizedRows() {
  const { user } = useAuth();
  const { data: studyNext } = useStudyNext();
  const { data: activePlan } = useStudentActivePlan();

  return useQuery({
    queryKey: ["enaflix-personalized-rows", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const results: {
        flashcards?: EnaflixFlashcardRowData;
        dailyPlan?: EnaflixDailyPlanRowData;
        tutorMissions: EnaflixTutorMissionRowData[];
        highYieldTopics: EnaflixHighYieldRowData[];
      } = {
        tutorMissions: [],
        highYieldTopics: [],
      };

      // 1. Flashcards Pendentes
      const nowIso = new Date().toISOString();
      const { data: dueCards } = await supabase
        .from("fsrs_cards")
        .select("id, card_ref_id, card_type")
        .eq("user_id", user!.id)
        .lte("due", nowIso);

      if (dueCards && dueCards.length > 0) {
        const flashRefIds = dueCards
          .filter((c) => c.card_type === "flashcard")
          .map((c) => c.card_ref_id);

        let mainTopic = "Diversos";
        if (flashRefIds.length > 0) {
          const { data: flashRows } = await supabase
            .from("flashcards")
            .select("topic")
            .in("id", flashRefIds)
            .limit(10);
          
          if (flashRows && flashRows.length > 0) {
            const topics = flashRows.map(f => f.topic).filter(Boolean);
            if (topics.length > 0) mainTopic = topics[0] as string;
          }
        }

        results.flashcards = {
          totalDue: dueCards.length,
          mainTopic,
          urgency: dueCards.length > 20 ? "alta" : dueCards.length > 5 ? "media" : "baixa",
        };
      }

      // 2. Plano de Hoje
      if (activePlan) {
        results.dailyPlan = {
          tasks: activePlan.subtopics.map(s => s.curriculum_subtopics?.nome || "Tarefa"),
          estimatedMinutes: activePlan.subtopics.length * 15,
          progressPercent: activePlan.progress?.progress_percent ?? 0,
          nextAction: activePlan.subtopics[0]?.curriculum_subtopics?.nome ?? "Retomar Estudo",
        };
      } else if (studyNext?.recommendation) {
        // Fallback for daily plan if no professor plan
        results.dailyPlan = {
          tasks: [studyNext.recommendation.title],
          estimatedMinutes: studyNext.recommendation.estimatedMinutes,
          progressPercent: 0,
          nextAction: studyNext.recommendation.title,
        };
      }

      // 3. Missões do Tutor IA
      if (studyNext) {
        results.tutorMissions = [
          {
            missionTitle: studyNext.recommendation.title,
            justification: studyNext.justification,
            criticalTopic: studyNext.adaptiveState.weakTopicsCount > 0 ? "Foco em fraquezas" : "Consolidação",
            missionId: "mission-1",
          },
          ...studyNext.alternativeActions.map((alt, i) => ({
            missionTitle: alt.title,
            justification: "Alternativa sugerida pela IA",
            criticalTopic: alt.type,
            missionId: `alt-${i}`,
          })),
        ];
      }

      // 4. Questões que Mais Caem (High Yield)
      const { data: highYield } = await supabase
        .from("performance_unified")
        .select("tema, taxa_acerto, questoes_feitas")
        .eq("user_id", user!.id)
        .order("questoes_feitas", { ascending: false })
        .limit(5);

      if (highYield) {
        results.highYieldTopics = highYield.map(hy => ({
          topic: hy.tema || "Geral",
          exam: "ENARE", // Default for now
          frequencyScore: 85 + Math.random() * 10,
          userPerformance: Number(hy.taxa_acerto) || 0,
        }));
      }

      return results;
    },
  });
}
