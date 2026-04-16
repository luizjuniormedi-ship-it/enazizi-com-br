import { useAuth } from "@/hooks/useAuth";
import { useCockpitData } from "@/hooks/useCockpitData";
import { useStudyNext } from "@/hooks/useStudyNext";
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
      {/* Bloco 1 — Hero */}
      <CockpitHero
        cockpit={cockpit}
        recommendation={studyNext?.recommendation}
        justification={studyNext?.justification ?? ""}
        userName={userName}
      />

      {/* Bloco 8 — Alertas (compacto) */}
      <CockpitAlerts alerts={cockpit.alerts} />

      {/* Blocos 7 + 11 lado a lado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitNextSteps steps={cockpit.nextSteps} />
        <CockpitVisualQuiz weaknesses={cockpit.visualWeaknesses} />
      </div>

      {/* Bloco 2 — Fraquezas */}
      <CockpitWeaknesses weaknesses={cockpit.topWeaknesses} />

      {/* Bloco 3 — Mnemônicos */}
      <CockpitMnemonics useful={cockpit.mnemUseful} bad={cockpit.mnemBad} />

      {/* Blocos 4 + 5 lado a lado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitMemory data={cockpit} />
        <CockpitPerformance data={cockpit} streak={streak} />
      </div>

      {/* Blocos 6 + 9 lado a lado */}
      <div className="grid lg:grid-cols-2 gap-4">
        <CockpitRadar radar={cockpit.radar} />
        <CockpitProfile profile={cockpit.cognitiveProfile} />
      </div>
    </div>
  );
}
