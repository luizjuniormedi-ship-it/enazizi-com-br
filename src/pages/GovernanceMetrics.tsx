
import { GovernanceCockpit } from "@/components/governance/GovernanceCockpit";
import { CinematicHero } from "@/components/cinematic";
import { Activity, ShieldCheck } from "lucide-react";
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

      <div className="px-1">
        <GovernanceCockpit />
      </div>
    </div>
  );
};

export default GovernanceMetrics;
