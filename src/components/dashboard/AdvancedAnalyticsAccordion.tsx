/**
 * AdvancedAnalyticsAccordion — Análises avançadas (colapsado)
 * ────────────────────────────────────────────────────────────
 * Wrapper único, fechado por padrão, contendo:
 *   • CognitiveCockpit (radar, perfil, memória, fraquezas, mnemônicos…)
 *   • QuestionStrategyCard
 *   • EngineImpactCard (telemetria do motor V3)
 *   • CalibrationStatusCard (calibração)
 *   • Justificativa + alternativas da missão atual
 *
 * Esses cards NÃO devem aparecer abertos no Dashboard principal.
 * O usuário precisa clicar para expandir.
 */
import { lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import type { StudyNextRecommendation } from "@/hooks/useStudyNext";

const CognitiveCockpit = lazy(() => import("@/components/cockpit/CognitiveCockpit"));
const QuestionStrategyCard = lazy(() => import("./guided/QuestionStrategyCard"));
const EngineImpactCard = lazy(() => import("./guided/EngineImpactCard"));
const CalibrationStatusCard = lazy(() => import("./guided/CalibrationStatusCard"));
const MissionJustification = lazy(() => import("@/components/mission-control/MissionJustification"));
const MissionAlternatives = lazy(() => import("@/components/mission-control/MissionAlternatives"));

interface Props {
  showMissionDetails?: boolean;
  justification?: string;
  adaptiveState?: any;
  alternatives?: StudyNextRecommendation[];
  activeRecType?: string;
  onSelectAlternative?: (alt: StudyNextRecommendation) => void;
}

export default function AdvancedAnalyticsAccordion({
  showMissionDetails,
  justification,
  adaptiveState,
  alternatives,
  activeRecType,
  onSelectAlternative,
}: Props) {
  return (
    <Card className="overflow-hidden border-border/60">
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced" className="border-0">
          <AccordionTrigger className="px-5 py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Análises avançadas</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Cockpit · Estratégia · Motor adaptativo
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5">
            <div className="space-y-4">
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <CognitiveCockpit />
              </Suspense>

              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <QuestionStrategyCard />
              </Suspense>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                  <EngineImpactCard />
                </Suspense>
                <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                  <CalibrationStatusCard />
                </Suspense>
              </div>

              {showMissionDetails && justification && (
                <Suspense fallback={null}>
                  <MissionJustification
                    justification={justification}
                    adaptiveState={adaptiveState}
                  />
                </Suspense>
              )}

              {showMissionDetails && alternatives && alternatives.length > 0 && onSelectAlternative && (
                <Suspense fallback={null}>
                  <MissionAlternatives
                    alternatives={alternatives.slice(0, 3)}
                    onSelect={onSelectAlternative}
                    activeType={activeRecType || "free_study"}
                  />
                </Suspense>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
