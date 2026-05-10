import { useAuth } from "@/hooks/useAuth";
import { useCockpitData } from "@/hooks/useCockpitData";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useOrchestrator } from "@/hooks/useOrchestrator";
import { useCoreData } from "@/hooks/useCoreData";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TrendingUp, Wrench } from "lucide-react";

import CockpitHero from "./CockpitHero";
import CockpitAlerts from "./CockpitAlerts";
import CockpitWeaknesses from "./CockpitWeaknesses";
import CockpitMnemonics from "./CockpitMnemonics";
import CockpitMemory from "./CockpitMemory";
import CockpitPerformance from "./CockpitPerformance";
import CockpitRadar from "./CockpitRadar";
import CockpitNextSteps from "./CockpitNextSteps";
import CockpitProfile from "./CockpitProfile";
import CockpitVisualQuiz from "./CockpitVisualQuiz";
import FsrsPremiumCard from "./FsrsPremiumCard";
import TriPremiumCard from "./TriPremiumCard";

export default function CognitiveCockpit() {
  const { user } = useAuth();
  const { data: cockpit, isLoading, isError } = useCockpitData();
  const { data: studyNext } = useStudyNext();
  const { data: core } = useCoreData();

  // F3: Orchestrator drives the Hero (with safe fallback to study-next)
  const { data: orchestrator } = useOrchestrator({ shadow: false, enabled: true });

  const userName = (core?.profile as any)?.display_name?.split(" ")[0];
  const streak = core?.gamification?.current_streak ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !cockpit) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Cockpit Cognitivo</h2>
        <p className="text-sm text-muted-foreground">
          Não conseguimos carregar suas métricas agora. Recarregue a página para tentar novamente.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ BLOCO 1 — HERO PRINCIPAL ═══ */}
      <CockpitHero
        cockpit={cockpit}
        recommendation={studyNext?.recommendation}
        justification={studyNext?.justification ?? ""}
        orchestrator={orchestrator ?? null}
        userName={userName}
      />

      {/* ═══ BLOCO 3 — ALERTAS ACIONÁVEIS ═══ */}
      <CockpitAlerts alerts={cockpit.alerts} />

      {/* ═══ BLOCO 3.5 — INTELIGÊNCIA REAL (FSRS + TRI proxy) ═══ */}
      <div className="grid lg:grid-cols-2 gap-4">
        <FsrsPremiumCard />
        <TriPremiumCard />
      </div>

      {/* ═══ BLOCO 6 — PRÓXIMOS PASSOS + QUIZ VISUAL (removido do Dashboard p/ evitar redundância) ═══ */}
      {/* 
      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitNextSteps steps={cockpit.nextSteps} />
        <CockpitVisualQuiz weaknesses={cockpit.visualWeaknesses} />
      </div>
      */}

      {/* ═══ BLOCO 4 — EVOLUÇÃO (agrupado e expansível) ═══ */}
      <Card className="overflow-hidden">
        <Accordion type="single" collapsible defaultValue="evolucao">
          <AccordionItem value="evolucao" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">📈 Evolução</span>
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  Radar · Memória · Performance · Perfil
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-4">
                  <CockpitRadar radar={cockpit.radar} />
                  <CockpitProfile profile={cockpit.cognitiveProfile} />
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                  <CockpitMemory data={cockpit} />
                  <CockpitPerformance data={cockpit} streak={streak} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* ═══ BLOCO 5 — FERRAMENTAS DE REFORÇO (agrupado e expansível) ═══ */}
      <Card className="overflow-hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="reforco" className="border-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-warning" />
                <span className="text-lg font-semibold">🛠️ Ferramentas de reforço</span>
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  Fraquezas · Mnemônicos
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-4">
                <CockpitWeaknesses weaknesses={cockpit.topWeaknesses} />
                <CockpitMnemonics useful={cockpit.mnemUseful} bad={cockpit.mnemBad} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}
