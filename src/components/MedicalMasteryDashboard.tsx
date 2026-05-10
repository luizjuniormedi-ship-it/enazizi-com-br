import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Activity, ShieldCheck, Zap, Ghost, GraduationCap, AlertTriangle, TrendingUp, Info } from "lucide-react";
import { useMedicalMastery, MasteryMetric } from "@/hooks/useMedicalMastery";
import { useMascotState } from "@/components/mascot/useMascotState";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function MedicalMasteryDashboard() {
  const { data: metrics, isLoading } = useMedicalMastery();
  const { triggerInteraction } = useMascotState();

  useEffect(() => {
    if (!isLoading && metrics) {
      const highRisk = metrics.find(m => m.overload_risk > 0.6);
      if (highRisk) {
        triggerInteraction({
          state: 'fatigue',
          type: 'alert',
          speech: `Atenção: alto risco de sobrecarga em ${highRisk.node_name}. Que tal uma pausa?`
        });
      }
    }
  }, [isLoading, metrics, triggerInteraction]);


  if (isLoading) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Mapeando Sinapses Clínicas...</p>
    </div>
  );
  
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {metrics.map((metric, idx) => (
            <motion.div
              key={metric.node_name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <MasteryCard metric={metric} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MasteryCard({ metric }: { metric: MasteryMetric }) {
  const averageScore = (
    (metric.theoretical_score + 
     metric.clinical_score + 
     metric.retention_stability + 
     metric.transfer_score) / 4
  ) * 100;

  return (
    <div className="card-pixar group hover:z-10 h-full flex flex-col">
      {/* Header */}
      <div className="p-5 pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <GraduationCap className="h-4 w-4 text-primary" />
              </div>
              <h4 className="text-[14px] font-black tracking-tight text-white leading-tight">
                {metric.node_name}
              </h4>
            </div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-8">Especialidade Médica</p>
          </div>
          <div className="flex flex-col items-end">
            <span className={cn(
              "text-[18px] font-black tracking-tighter leading-none",
              averageScore > 80 ? "text-emerald-400" : "text-white"
            )}>
              {averageScore.toFixed(0)}%
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 mt-1">Maestria</span>
          </div>
        </div>
      </div>

      {/* Metrics Body */}
      <div className="px-5 py-4 space-y-5 flex-1">
        <div className="space-y-2.5">
          <MetricRow 
            icon={<Brain className="h-3 w-3" />} 
            label="Base Teórica" 
            value={metric.theoretical_score} 
            color="bg-blue-400"
          />
          <MetricRow 
            icon={<Activity className="h-3 w-3" />} 
            label="Raciocínio Clínico" 
            value={metric.clinical_score} 
            color="bg-emerald-400"
          />
          <MetricRow 
            icon={<ShieldCheck className="h-3 w-3" />} 
            label="Estabilidade (FSRS)" 
            value={metric.retention_stability} 
            color="bg-purple-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
          <div className="space-y-1">
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-white/40 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-400" /> Velocidade
            </div>
            <div className="text-[13px] font-black text-white">{(metric.speed_factor * 100).toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-white/40 flex items-center gap-1.5">
              <Ghost className="h-3 w-3 text-blue-300" /> Tutor Dep.
            </div>
            <div className="text-[13px] font-black text-white">{(metric.dependency_factor * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Predictive Projection */}
        <div className="pt-4 border-t border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/60">Projeção IA</span>
            </div>
            <Badge variant="outline" className="text-[8px] bg-white/5 border-white/10 text-white/50 px-1.5 h-4">Predictive</Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-white/60">Retenção Estimada (30d)</span>
                <span className="text-emerald-400">{(metric.retention_projection * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.retention_projection * 100}%` }}
                  className="h-full bg-emerald-400"
                />
              </div>
            </div>

            <div className={cn(
              "p-3 rounded-2xl border transition-colors",
              metric.overload_risk > 0.6 ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/5"
            )}>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-white/60">Risco de Sobrecarga</span>
                <span className={cn(metric.overload_risk > 0.6 ? "text-red-500" : "text-white/80")}>
                  {(metric.overload_risk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.overload_risk * 100}%` }}
                  className={cn("h-full", metric.overload_risk > 0.6 ? "bg-red-500" : "bg-white/30")}
                />
              </div>
            </div>
          </div>

          {metric.false_mastery_risk > 0.4 && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-200/80 leading-relaxed font-bold italic">
                Sinal de Falsa Maestria detectado. Reforço sugerido.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
        <span className="flex items-center gap-1.5 text-white/60">
          {icon} {label}
        </span>
        <span className="text-white">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          className={cn("h-full transition-all duration-1000", color)}
        />
      </div>
    </div>
  );
}
