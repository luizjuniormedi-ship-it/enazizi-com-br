import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CoreDataResult {
  profile: {
    display_name: string | null;
    has_completed_diagnostic: boolean;
    target_exams: string[];
    target_exam: string | null;
    exam_date: string | null;
    last_study_plan_reset_at: string | null;
  };
  adaptiveProfile: {
    cognitive_stress_index: number;
    recovery_mode_active: boolean;
    current_session_mode: string;
  } | null;
  practiceAttempts: { correct: boolean; created_at: string }[];
  revisoes: { id: string; status: string; data_revisao: string; created_at: string }[];
  examSessions: { score: number; total_questions: number; finished_at: string }[];
  anamnesisResults: { final_score: number; created_at: string }[];
  temasEstudados: { id: string; tema: string; especialidade: string | null; created_at: string }[];
  temasCount: number;
  simulationSessionsCount: number;
  osceScores: { score: number }[];
  gamification: { current_streak: number; xp: number; level: number } | null;
  errorBankCount: number;
  approvalScores: { score: number; created_at: string }[];
  domainMap: { specialty: string; domain_score: number; questions_answered: number; correct_answers: number }[];
}

async function fetchCoreData(userId: string): Promise<CoreDataResult> {
  const profileRes = await supabase.from("profiles")
    .select("display_name, has_completed_diagnostic, target_exams, target_exam, exam_date, last_study_plan_reset_at")
    .eq("user_id", userId).maybeSingle();
  
  const ep = profileRes.data as any;
  const resetAt = ep?.last_study_plan_reset_at || null;

  const [
    practiceRes, revisoesRes, examRes,
    anamnesisRes, temasRes, simRes, osceRes,
    gamRes, errorRes, approvalRes, domainRes,
    adaptiveRes,
  ] = await Promise.all([
    supabase.from("practice_attempts")
      .select("correct, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("revisoes")
      .select("id, status, data_revisao, created_at")
      .eq("user_id", userId)
      .gt("created_at", resetAt || "1900-01-01T00:00:00Z"),
    supabase.from("exam_sessions")
      .select("score, total_questions, finished_at")
      .eq("user_id", userId).eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(50),
    supabase.from("anamnesis_results")
      .select("final_score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("temas_estudados")
      .select("id, tema, especialidade, created_at", { count: "exact" })
      .eq("user_id", userId)
      .gt("created_at", resetAt || "1900-01-01T00:00:00Z"),
    supabase.from("simulation_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "finished"),
    supabase.from("chronicle_osce_sessions")
      .select("score")
      .eq("user_id", userId),
    supabase.from("user_gamification")
      .select("current_streak, xp, level")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("error_bank")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("updated_at", resetAt || "1900-01-01T00:00:00Z"),
    supabase.from("approval_scores")
      .select("score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("medical_domain_map")
      .select("specialty, domain_score, questions_answered, correct_answers")
      .eq("user_id", userId),
    supabase.from("adaptive_student_profiles")
      .select("cognitive_stress_index, recovery_mode_active, current_session_mode")
      .eq("user_id", userId).maybeSingle(),
  ]);

  let targetExams: string[] = [];
  if (Array.isArray(ep?.target_exams) && ep.target_exams.length > 0) {
    targetExams = ep.target_exams;
  } else if (ep?.target_exam) {
    targetExams = [ep.target_exam];
  }

  return {
    profile: {
      display_name: ep?.display_name || null,
      has_completed_diagnostic: ep?.has_completed_diagnostic || false,
      target_exams: targetExams,
      target_exam: ep?.target_exam || null,
      exam_date: ep?.exam_date || null,
      last_study_plan_reset_at: ep?.last_study_plan_reset_at || null,
    },
    practiceAttempts: (practiceRes.data || []) as any[],
    revisoes: (revisoesRes.data || []) as any[],
    examSessions: (examRes.data || []) as any[],
    anamnesisResults: (anamnesisRes.data || []) as any[],
    temasEstudados: (temasRes.data || []) as any[],
    temasCount: temasRes.count || 0,
    simulationSessionsCount: simRes.count || 0,
    osceScores: (osceRes.data || []) as any[],
    gamification: gamRes.data as any,
    errorBankCount: errorRes.count || 0,
    approvalScores: (approvalRes.data || []) as any[],
    domainMap: (domainRes.data || []) as any[],
    adaptiveProfile: adaptiveRes.data as any,
  };
}

export function useCoreData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["core-data", user?.id],
    queryFn: () => fetchCoreData(user!.id),
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 30 * 60 * 1000, // 30 min GC
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["core-data"] });

  return { ...query, refresh };
}