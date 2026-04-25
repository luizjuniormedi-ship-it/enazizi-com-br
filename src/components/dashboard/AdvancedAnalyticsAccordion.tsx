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
import { forwardRef, lazy, Suspense } from "react";
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
  /** Estado controlado do accordion (para abrir programaticamente via Hero "Alternativas"). */
  value?: string;
  onValueChange?: (value: string) => void;
}

const AdvancedAnalyticsAccordion = forwardRef<HTMLDivElement, Props>(
  (
    {
      showMissionDetails,
      justification,
      adaptiveState,
      alternatives,
      activeRecType,
      onSelectAlternative,
      value,
      onValueChange,
    },
    ref,
  ) => {
    return (
      <Card ref={ref} className="overflow-hidden border-white/5 bg-card/40 backdrop-blur-sm shadow-sm rounded-2xl">
        <Accordion type="single" collapsible value={value} onValueChange={onValueChange}>
          <AccordionItem value="advanced" className="border-0">
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/5 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[13px] font-black uppercase tracking-tight">Análises de Motor e Estratégia</span>
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                    Cockpit Cognitivo · Telemetria · Calibração
                  </span>
                </div>
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
  },
);

AdvancedAnalyticsAccordion.displayName = "AdvancedAnalyticsAccordion";

export default AdvancedAnalyticsAccordion;
