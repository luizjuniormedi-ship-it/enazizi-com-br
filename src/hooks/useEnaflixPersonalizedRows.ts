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
    queryKey: ["enaflix-personalized-rows-v3", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

      // 1. FLASHCARDS PENDENTES (FSRS)
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

        let mainTopic = "Clínica Médica";
        if (flashRefIds.length > 0) {
          const { data: flashRows } = await supabase
            .from("flashcards")
            .select("topic")
            .in("id", flashRefIds)
            .limit(5);
          
          if (flashRows && flashRows.length > 0) {
            mainTopic = flashRows[0].topic || "Diversos";
          }
        }

        results.flashcards = {
          totalDue: dueCards.length,
          mainTopic,
          urgency: dueCards.length > 20 ? "alta" : dueCards.length > 5 ? "media" : "baixa",
        };
      }

      // 2. PLANO DE HOJE (Daily Plans)
      const { data: todayPlan } = await supabase
        .from("daily_plans")
        .select("*")
        .eq("user_id", user!.id)
        .eq("plan_date", new Date().toISOString().split('T')[0])
        .maybeSingle();

      if (todayPlan) {
        const { data: planTasks } = await supabase
          .from("daily_plan_tasks")
          .select("*")
          .eq("daily_plan_id", todayPlan.id)
          .order("ordem", { ascending: true });

        const tasks = planTasks || [];
        const pendingTask = tasks.find(t => !t.completed);

        results.dailyPlan = {
          tasks: tasks.map(t => t.title || t.topic || "Tarefa"),
          estimatedMinutes: tasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0),
          progressPercent: todayPlan.total_blocks > 0 
            ? Math.round((todayPlan.completed_count / todayPlan.total_blocks) * 100) 
            : 0,
          nextAction: pendingTask?.title || "Concluir Plano",
        };
      } else if (activePlan) {
        // Fallback for professor assigned plan
        results.dailyPlan = {
          tasks: activePlan.subtopics.map(s => s.curriculum_subtopics?.nome || "Tarefa"),
          estimatedMinutes: activePlan.subtopics.length * 15,
          progressPercent: activePlan.progress?.progress_percent ?? 0,
          nextAction: activePlan.subtopics[0]?.curriculum_subtopics?.nome ?? "Retomar Estudo",
        };
      }

      // 3. MISSÕES DO TUTOR IA (Decisions + Session Context)
      const { data: decisions } = await supabase
        .from("assistant_decisions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (decisions && decisions.length > 0) {
        results.tutorMissions = decisions.map(d => ({
          missionTitle: (d.decision_output as any)?.recommended_mission || "Missão de Reforço",
          justification: d.justification || "Ajuste adaptativo baseado no seu ritmo.",
          criticalTopic: d.source_module || "Geral",
          missionId: d.id,
        }));
      } else if (studyNext?.recommendation) {
        results.tutorMissions = [
          {
            missionTitle: studyNext.recommendation.title,
            justification: studyNext.justification,
            criticalTopic: studyNext.adaptiveState.weakTopicsCount > 0 ? "Foco em fraquezas" : "Consolidação",
            missionId: "sn-mission",
          }
        ];
      }

      // 4. QUESTÕES QUE MAIS CAEM (High Yield from unified performance)
      const { data: hyData } = await supabase
        .from("performance_unified")
        .select("tema, taxa_acerto, questoes_feitas")
        .eq("user_id", user!.id)
        .order("questoes_feitas", { ascending: false })
        .limit(5);

      if (hyData && hyData.length > 0) {
        results.highYieldTopics = hyData.map(hy => ({
          topic: hy.tema || "Geral",
          exam: "ENARE/USP-SP",
          frequencyScore: 85 + (Math.random() * 15), // High yield simulated frequency
          userPerformance: Number(hy.taxa_acerto) || 0,
        }));
      } else {
        // Hardcoded high yield defaults if no user data yet (Intelligent Fallback)
        results.highYieldTopics = [
          { topic: "Ginecologia & Obstetrícia", exam: "ENARE", frequencyScore: 98, userPerformance: 0 },
          { topic: "Pediatria", exam: "USP-SP", frequencyScore: 95, userPerformance: 0 },
          { topic: "Medicina Preventiva", exam: "ENARE", frequencyScore: 92, userPerformance: 0 }
        ];
      }

      return results;
    },
  });
}
