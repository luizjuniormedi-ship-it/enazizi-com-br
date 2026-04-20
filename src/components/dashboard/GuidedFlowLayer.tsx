/**
 * GuidedFlowLayer
 * ───────────────
 * Camada de orientação inteligente no topo do Dashboard.
 *
 * Modelo Tutor-first + navegação livre:
 *   - Sugere o próximo passo (Tutor / Missão / Revisão / Foco / NBA)
 *   - NÃO bloqueia navegação
 *   - NÃO esconde nenhum módulo
 *   - NÃO altera schema, RLS ou edge functions
 *
 * Layout responsivo: 1 col (mobile) → 2 cols (md+).
 * StartHere e NextBestAction ocupam linha inteira (full-span).
 */
import StartHereCard from "./guided/StartHereCard";
import NextBestActionCard from "./guided/NextBestActionCard";
import MissionCard from "./guided/MissionCard";
import ReviewCard from "./guided/ReviewCard";
import GuidedFocusCard from "./guided/GuidedFocusCard";

export default function GuidedFlowLayer() {
  return (
    <section aria-label="Orientação inteligente" className="space-y-3">
      <StartHereCard />
      <NextBestActionCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MissionCard />
        <ReviewCard />
        <GuidedFocusCard />
      </div>
    </section>
  );
}
