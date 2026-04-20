/**
 * GuidedFlowLayer — versão enxuta (Dashboard reestruturado)
 * ──────────────────────────────────────────────────────────
 * Mantém APENAS o que dispara ação imediata:
 *   1. ExamDateRequiredBanner (condicional)
 *   2. RiskAlertsCard (alertas críticos)
 *   3. MinimumDailyMissionCard (reativação para inativos)
 *   4. NextBestActionCard (próximo passo único)
 *   5. MissionCard (missão do dia)
 *   6. ReviewCard (só se houver revisões — ele mesmo já trata "tudo em dia")
 *
 * Cards REMOVIDOS desta camada (movidos para AdvancedAnalyticsAccordion ou deletados):
 *   • StartHereCard (redundante com Hero)
 *   • GuidedFocusCard (duplicava FocusCard)
 *   • CoverageCard, MonthlyGoalCard, QuestionsGoalCard (fundidos em ProgressOverview)
 *   • QuestionStrategyCard, EngineImpactCard, CalibrationStatusCard (movidos p/ accordion)
 *   • FocusModeEntry (movido p/ TopBar futuramente)
 */
import ExamDateRequiredBanner from "./guided/ExamDateRequiredBanner";
import RiskAlertsCard from "./guided/RiskAlertsCard";
import MinimumDailyMissionCard from "./guided/MinimumDailyMissionCard";
import NextBestActionCard from "./guided/NextBestActionCard";
import MissionCard from "./guided/MissionCard";
import ReviewCard from "./guided/ReviewCard";

export default function GuidedFlowLayer() {
  return (
    <section aria-label="Ações guiadas" className="space-y-3">
      {/* Inputs críticos faltando */}
      <ExamDateRequiredBanner />

      {/* Alertas de risco (máx 3) */}
      <RiskAlertsCard />

      {/* Reativação para usuários inativos */}
      <MinimumDailyMissionCard />

      {/* As 3 ações principais — únicas que iniciam estudo */}
      <NextBestActionCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MissionCard />
        <ReviewCard />
      </div>
    </section>
  );
}
