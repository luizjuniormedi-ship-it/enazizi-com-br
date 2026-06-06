import { useMemo, useEffect } from "react";
import { useCoreData } from "./useCoreData";
import { useApprovalPrediction } from "./useApprovalPrediction";
import { calculateLearningScienceSnapshot } from "@/engines/learningScienceEngine";
import { LearningScienceSnapshot } from "@/types/learningScience";
import { telemetry } from "@/lib/pedagogicalTelemetry";

export function useLearningScience(): LearningScienceSnapshot | null {
  const { data: core } = useCoreData();
  const prediction = useApprovalPrediction();

  const snapshot = useMemo(() => {
    if (!core || !prediction) return null;

    // Calculamos retenção proxy baseada no FSRS
    const totalRev = core.revisoes.length;
    const completed = core.revisoes.filter(r => r.status === 'concluida').length;
    const retentionRate = totalRev > 0 ? (completed / totalRev) * 100 : 0;

    // Calculamos recovery proxy (erros que viraram acertos)
    // Simplificamos pegando o count do banco de erros vs total de acertos recentes
    const recoverySuccessRate = 75; // Mocked for now: needs specialized query

    // Mapeamos os scores históricos formatando para o motor
    const mappedHistory = core.approvalScores.map(s => ({
      score: s.score,
      date: s.created_at
    })).reverse(); // Garantir ordem cronológica

    return calculateLearningScienceSnapshot(prediction, {
      approvalScores: mappedHistory,
      retentionRate,
      recoverySuccessRate,
      tutorUsageMinutes: 45, // Placeholder: integration with tutor logs needed
      nonTutorGroupAvgReadiness: 58, // Placeholder: benchmark data
      fsrsBacklog: core.revisoes.filter(r => r.status === 'pendente').length,
      errorBankCount: core.errorBankCount,
      streakDays: core.gamification?.current_streak ?? 0
    });
  }, [core, prediction]);

  // LS-10: Feature Attribution & Telemetry
  useEffect(() => {
    if (snapshot) {
      telemetry.track('ls_readiness_validated', { score: snapshot.readiness });
      telemetry.track('ls_learning_yield_updated', { score: snapshot.learningYield.score });
      telemetry.track('ls_risk_index_updated', { level: snapshot.riskIndex.level });
    }
  }, [snapshot?.validatedAt]);

  return snapshot;
}
