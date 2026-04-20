/**
 * GuidedFlowLayer — versão enxuta (Dashboard reestruturado)
 * ──────────────────────────────────────────────────────────
 * Mantém APENAS o que dispara ação imediata. Fluxo:
 *   1. ExamDateRequiredBanner (condicional)
 *   2. RiskAlertsCard
 *   3. MinimumDailyMissionCard
 *   4. NextBestActionCard (escondido se duplicar Mission/Review)
 *   5. MissionCard (Plano do dia) | ReviewCard (esconde se 0 due)
 *
 * Ajuste fino UX:
 *   • CTA dominante = só o Hero. NBA → secondary, Mission/Review → outline.
 *   • Deduplicação: NBA não renderiza se aponta para o mesmo destino que
 *     o MissionCard ou ReviewCard já mostram visíveis no fold.
 */
import { useFsrsDueCount } from "@/hooks/useFsrsDueCount";
import { useDashboardData } from "@/hooks/useDashboardData";
import ExamDateRequiredBanner from "./guided/ExamDateRequiredBanner";
import RiskAlertsCard from "./guided/RiskAlertsCard";
import MinimumDailyMissionCard from "./guided/MinimumDailyMissionCard";
import NextBestActionCard from "./guided/NextBestActionCard";
import MissionCard from "./guided/MissionCard";
import ReviewCard from "./guided/ReviewCard";

export default function GuidedFlowLayer() {
  const { totalDue } = useFsrsDueCount();
  const { data: dash } = useDashboardData();
  const todayPending = Math.max(
    0,
    (dash?.stats.todayTotal ?? 0) - (dash?.stats.todayCompleted ?? 0)
  );

  // Paths atualmente cobertos por Mission/Review visíveis — usados para deduplicar o NBA
  const excludePaths: string[] = [];
  if (totalDue > 0) excludePaths.push("/dashboard/revisoes");
  if (todayPending > 0) excludePaths.push("/dashboard/cronograma");

  return (
    <section aria-label="Ações guiadas" className="space-y-3">
      {/* Inputs críticos faltando */}
      <ExamDateRequiredBanner />

      {/* Alertas de risco (máx 3) */}
      <RiskAlertsCard />

      {/* Reativação para usuários inativos */}
      <MinimumDailyMissionCard />

      {/* Atalho rápido — só aparece se não duplicar ação visível abaixo */}
      <NextBestActionCard excludePaths={excludePaths} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MissionCard />
        <ReviewCard />
      </div>
    </section>
  );
}
