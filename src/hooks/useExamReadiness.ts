import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCoreData, CoreDataResult } from "./useCoreData";
import { calculateAllExamReadiness, type ExamReadiness, type ReadinessInput } from "@/lib/examReadiness";
import { calculateReadinessScoreV2 } from "@/lib/examReadinessV2";
import { emitSafeEvent } from "@/lib/safeTelemetry";

function buildReadinessFromCoreData(cd: CoreDataResult, practicalScoresExtra: number[]): ExamReadiness[] {
  const targetExams = cd.profile.target_exams;
  if (targetExams.length === 0) return [];

  const attempts = cd.practiceAttempts;
  const totalCorrect = attempts.filter(a => a.correct).length;
  const totalQuestions = attempts.length;

  const accuracyBySpecialty: Record<string, { correct: number; total: number }> = {};
  for (const d of cd.domainMap) {
    accuracyBySpecialty[d.specialty] = {
      correct: d.correct_answers || 0,
      total: d.questions_answered || 0,
    };
  }

  const recent = attempts.slice(0, 50);
  const recentCorrect = recent.filter(a => a.correct).length;
  const recentAccuracy = recent.length > 0 ? (recentCorrect / recent.length) * 100 : 0;

  const accuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const domains = cd.domainMap;
  const avgDomain = domains.length > 0
    ? domains.reduce((s, d) => s + (d.domain_score || 0), 0) / domains.length : 0;
  const volumeScore = Math.min((totalQuestions / 500) * 100, 100);
  const approvalScore = Math.round(accuracy * 0.35 + avgDomain * 0.25 + volumeScore * 0.20 + 20 * 0.20);

  const pendingRevisoes = cd.revisoes.filter(r => r.status === "pendente").length;
  const studiedTopics = cd.temasEstudados.map(t => (t.tema || "").toLowerCase());

  const input: ReadinessInput = {
    approvalScore,
    accuracyBySpecialty,
    simuladoScores: cd.examSessions.map(e => e.score || 0),
    practicalScores: [
      ...cd.anamnesisResults.map(a => a.final_score || 0),
      ...practicalScoresExtra,
    ],
    overdueReviews: pendingRevisoes,
    totalQuestionsAnswered: totalQuestions,
    streak: cd.gamification?.current_streak || 0,
    recentAccuracy,
    studiedTopics,
  };

  const readinessList = calculateAllExamReadiness(input, targetExams);
  
  // Calculate V2 Readiness for ENAMED specifically
  const enamedProfile = readinessList.find(r => r.examKey.toUpperCase() === "ENAMED" || r.examName.toUpperCase() === "ENAMED");
  
  if (enamedProfile) {
    const v2Score = calculateReadinessScoreV2({
      masteryScore: input.recentAccuracy, // Domain (simplified as recent accuracy)
      incidenceMastery: input.approvalScore, // Incidence mastery (simplified using existing approval score)
      fsrsRetention: 85, // Retention FSRS (mock or query if available)
      simuladoPerformance: input.simuladoScores.length > 0 ? (input.simuladoScores.reduce((a, b) => a + b, 0) / input.simuladoScores.length) : 0
    });
    
    // Telemetry: [READINESS_SCORE_UPDATED]
    emitSafeEvent("READINESS_SCORE_UPDATED", {
      score: v2Score,
      examKey: enamedProfile.examKey,
      label: enamedProfile.readinessLabel
    });
  }

  return readinessList;
}

export const useExamReadiness = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();

  return useQuery({
    queryKey: ["exam-readiness", user?.id, !!coreData],
    queryFn: async () => {
      // Only extra query: practical_exam_results (not in coreData)
      const { data: practicalRes } = await supabase
        .from("practical_exam_results")
        .select("final_score")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const practicalScores = (practicalRes || []).map((p: any) => p.final_score || 0);
      return buildReadinessFromCoreData(coreData!, practicalScores);
    },
    enabled: !!user && !!coreData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
