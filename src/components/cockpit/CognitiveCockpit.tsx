import { useAuth } from "@/hooks/useAuth";
import { useCockpitData } from "@/hooks/useCockpitData";
import { useStudyNext } from "@/hooks/useStudyNext";
import { useOrchestrator } from "@/hooks/useOrchestrator";
import { useCoreData } from "@/hooks/useCoreData";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
      {/* Bloco 1 — Hero (orquestrador com fallback seguro para study-next) */}
      <CockpitHero
        cockpit={cockpit}
        recommendation={studyNext?.recommendation}
        justification={studyNext?.justification ?? ""}
        orchestrator={orchestrator ?? null}
        userName={userName}
      />

      <CockpitAlerts alerts={cockpit.alerts} />

      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitNextSteps steps={cockpit.nextSteps} />
        <CockpitVisualQuiz weaknesses={cockpit.visualWeaknesses} />
      </div>

      <CockpitWeaknesses weaknesses={cockpit.topWeaknesses} />

      <CockpitMnemonics useful={cockpit.mnemUseful} bad={cockpit.mnemBad} />

      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitMemory data={cockpit} />
        <CockpitPerformance data={cockpit} streak={streak} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitRadar radar={cockpit.radar} />
        <CockpitProfile profile={cockpit.cognitiveProfile} />
      </div>
    </div>
  );
}
