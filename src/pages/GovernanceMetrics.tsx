
import { GovernanceCockpit } from "@/components/governance/GovernanceCockpit";
import { CinematicHero } from "@/components/cinematic";
import AlosRuntimeObservatory from "@/components/observatory/AlosRuntimeObservatory";
import { CognitiveRhythmMonitor } from "@/components/CognitiveRhythmMonitor";
import { Activity, ShieldCheck, Search, Zap } from "lucide-react";
import { useEffect } from "react";
import { telemetry } from "@/lib/pedagogicalTelemetry";

const GovernanceMetrics = () => {
  useEffect(() => {
    telemetry.track('metrics_opened');
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <CinematicHero
        module="analytics"
        eyebrow={<><ShieldCheck className="h-3.5 w-3.5" /> Transparência Algorítmica</>}
        title="Painel de Métricas"
        subtitle="Acompanhe a integridade do seu ecossistema cognitivo e a eficácia da governança pedagógica do ENAZIZI."
        media={
          <div className="hidden lg:flex h-24 w-24 items-center justify-center rounded-2xl glass-premium-strong glow-module">
            <Activity className="h-10 w-10 text-module" />
          </div>
        }
      />

      <div className="px-1 space-y-12">
        <GovernanceCockpit />
        
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AlosRuntimeObservatory />
          </div>
          <div className="space-y-6">
            <Card className="p-6 bg-card/50 border-white/10">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                <Zap className="h-5 w-5 text-warning" />
                Rhythm & Persistence
              </h3>
              <CognitiveRhythmMonitor />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernanceMetrics;
