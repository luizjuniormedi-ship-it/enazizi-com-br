/**
 * GuidedFlowLayer — Nível 2
 * ─────────────────────────
 * Camada de orientação inteligente no topo do Dashboard.
 *
 * Modelo Tutor-first + navegação livre:
 *   - Sugere o próximo passo (Tutor / Missão / Revisão / Foco / NBA)
 *   - Toggle "Modo Foco" (esconde ruído, mantém só guiado)
 *   - NÃO bloqueia navegação
 *   - NÃO altera schema, RLS ou edge functions
 *
 * Ordem visual do topo (especificação Nível 2):
 *   1. StartHereCard
 *   2. NextBestActionCard
 *   3. MissionCard
 *   4. ReviewCard
 *   5. GuidedFocusCard
 *   6. FocusModeEntry
 */
import StartHereCard from "./guided/StartHereCard";
import NextBestActionCard from "./guided/NextBestActionCard";
import MissionCard from "./guided/MissionCard";
import ReviewCard from "./guided/ReviewCard";
import GuidedFocusCard from "./guided/GuidedFocusCard";
import CoverageCard from "./guided/CoverageCard";
import MonthlyGoalCard from "./guided/MonthlyGoalCard";
import FocusModeEntry from "./guided/FocusModeEntry";

export default function GuidedFlowLayer() {
  return (
    <section aria-label="Orientação inteligente" className="space-y-3">
      <StartHereCard />
      <NextBestActionCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MissionCard />
        <ReviewCard />
        <GuidedFocusCard />
        <CoverageCard />
        <MonthlyGoalCard />
      </div>
      <FocusModeEntry />
    </section>
  );
}
