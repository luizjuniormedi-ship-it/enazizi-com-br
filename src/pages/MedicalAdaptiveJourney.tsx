import { BrainCircuit, Activity, Zap, ShieldCheck, Clock, Calendar, History, TrendingUp } from "lucide-react";
import { useAdaptiveJourney, useCognitiveHistory } from "@/hooks/useAdaptiveJourney";
import { cn } from "@/lib/utils";
import { CognitiveRhythmMonitor } from "@/components/CognitiveRhythmMonitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CognitiveSchedulerMonitor from "@/components/CognitiveSchedulerMonitor";
import { EnaflixSection } from "@/components/enaflix/EnaflixSection";
import { JourneyTimeline } from "@/components/enaflix/JourneyTimeline";
import { CognitiveSessionController } from "@/components/CognitiveSessionController";
import { motion } from "framer-motion";

export default function MedicalAdaptiveJourney() {
  const { data: events, isLoading } = useAdaptiveJourney();
  const { data: history } = useCognitiveHistory();

  if (isLoading) return <div className="p-8 text-center text-white/40">Mapeando sua jornada cognitiva...</div>;

  return (
    <div className="pb-24 pt-8 space-y-12">
      {/* Header */}
      <div className="px-4 sm:px-8 lg:px-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <BrainCircuit className="h-8 w-8 text-primary" />
              Minha Jornada
            </h1>
            <p className="text-sm text-white/50 mt-1 font-medium">
              Transparência total sobre como a IA de estudos ajusta seu aprendizado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary animate-pulse">
              <ShieldCheck className="h-3.5 w-3.5" /> Motor Ativo
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="session" className="space-y-12">
        <div className="px-4 sm:px-8 lg:px-14">
          <TabsList className="bg-white/5 p-1 border border-white/5">
            <TabsTrigger value="session" className="gap-2 px-6 data-[state=active]:bg-white/10">
              <Zap className="h-4 w-4" /> Sessão Atual
            </TabsTrigger>
            <TabsTrigger value="longitudinal" className="gap-2 px-6 data-[state=active]:bg-white/10">
              <Clock className="h-4 w-4" /> Ritmo de Estudo
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="gap-2 px-6 data-[state=active]:bg-white/10">
              <Calendar className="h-4 w-4" /> IA Organizadora
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="session" className="m-0 space-y-12 outline-none">
          <EnaflixSection 
            title="Caminho Percorrido" 
            subtitle="Por que a IA recomendou cada ajuste?"
          >
            {events && events.length > 0 ? (
              <JourneyTimeline events={events} />
            ) : (
              <div className="px-4 sm:px-8 lg:px-14">
                <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
                  <p className="text-white/40 italic">Sua jornada ainda está sendo calibrada pela IA.</p>
                </div>
              </div>
            )}
          </EnaflixSection>

          <div className="px-4 sm:px-8 lg:px-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <EnaflixSection title="Status da Sessão" className="px-0">
                <CognitiveSessionController />
              </EnaflixSection>
            </div>

            <div className="space-y-8">
              <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-bold flex items-center gap-2 text-white mb-6 uppercase tracking-widest">
                  <Activity className="h-4 w-4 text-primary" /> Carga Cognitiva
                </h3>
                <div className="h-40 flex items-end gap-1.5">
                  {[40, 30, 25, 60, 45, 30, 20, 35, 15, 25, 40, 50].map((val, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ delay: i * 0.05 }}
                      className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors"
                    />
                  ))}
                </div>
                <p className="text-[10px] text-white/30 text-center mt-4 font-medium uppercase tracking-widest">
                  Últimos 12 blocos de estudo
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-6">
                <h3 className="text-sm font-bold flex items-center gap-2 text-white uppercase tracking-widest">
                  <Zap className="h-4 w-4 text-primary" /> Intensidade da IA
                </h3>
                <div className="space-y-3">
                  <IntensityOption 
                    label="Silencioso" 
                    description="Menos intervenções, foco em autonomia."
                    active={false}
                  />
                  <IntensityOption 
                    label="Equilibrado" 
                    description="Otimização padrão do motor adaptativo."
                    active={true}
                  />
                  <IntensityOption 
                    label="Intenso" 
                    description="Máxima proatividade e micro-revisões."
                    active={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="longitudinal" className="m-0 outline-none">
          <div className="px-4 sm:px-8 lg:px-14">
            <CognitiveRhythmMonitor />
          </div>
        </TabsContent>

        <TabsContent value="scheduler" className="m-0 outline-none">
          <div className="px-4 sm:px-8 lg:px-14">
            <CognitiveSchedulerMonitor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntensityOption({ label, description, active }: { label: string; description: string; active: boolean }) {
  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all cursor-pointer",
      active 
        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" 
        : "bg-white/5 border-white/5 hover:bg-white/10"
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-primary" : "text-white/60")}>
          {label}
        </span>
        {active && <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" />}
      </div>
      <p className="text-[10px] text-white/40 leading-tight font-medium">{description}</p>
    </div>
  );
}
