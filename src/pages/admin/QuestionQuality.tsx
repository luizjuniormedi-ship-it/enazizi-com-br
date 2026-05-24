
import { CinematicHero } from "@/components/cinematic";
import { ShieldCheck, Microscope } from "lucide-react";
import { QuestionQualityPanel } from "@/components/admin/QuestionQualityPanel";

const QuestionQuality = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <CinematicHero
        module="analytics"
        eyebrow={<><ShieldCheck className="h-3.5 w-3.5" /> Auditoria Forense v14</>}
        title="Qualidade de Questões"
        subtitle="Benchmark real vs IA. Monitoramento de drift de banca e integridade pedagógica."
        media={
          <div className="hidden lg:flex h-24 w-24 items-center justify-center rounded-2xl glass-premium-strong glow-module">
            <Microscope className="h-10 w-10 text-module" />
          </div>
        }
      />

      <div className="px-1">
        <QuestionQualityPanel />
      </div>
    </div>
  );
};

export default QuestionQuality;
