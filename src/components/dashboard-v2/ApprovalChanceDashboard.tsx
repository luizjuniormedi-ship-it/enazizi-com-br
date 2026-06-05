import { motion } from "framer-motion";
import { TrendingUp, Target, Award, ChevronRight, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useExamReadiness } from "@/hooks/useExamReadiness";
import { Skeleton } from "@/components/ui/skeleton";
import { getLabelText } from "@/lib/examReadiness";

export const ApprovalChanceDashboard = () => {
  const { data: readinessData, isLoading } = useExamReadiness();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-[32px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Filter for ENAMED or the first one available
  const enamed = readinessData?.find(r => r.examKey.toLowerCase().includes('enamed')) || readinessData?.[0];

  if (!enamed) return null;

  const globalChance = enamed.readinessScore;

  return (
    <div className="space-y-6">
      {/* Main Score */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-white/10 p-8">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Target className="h-32 w-32 text-white" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Indicador Principal</p>
            <h3 className="text-4xl font-black text-white">Chance de Aprovação</h3>
            <p className="text-slate-400 max-w-md">Calculado com base na sua performance real vs. incidência histórica ENAMED 2026.</p>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-32 w-32 flex items-center justify-center">
              <svg className="h-full w-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/5"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={364}
                  initial={{ strokeDashoffset: 364 }}
                  animate={{ strokeDashoffset: 364 - (364 * globalChance) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-indigo-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{globalChance}%</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {areaChances.map((area, idx) => (
          <motion.div
            key={area.area}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${area.color}`} />
                <span className="font-bold text-white text-sm uppercase tracking-wide">{area.area}</span>
              </div>
              <Badge variant="outline" className="bg-white/5 border-white/10 text-[10px] font-bold">
                {area.score >= 80 ? "ZONA SEGURA" : area.score >= 70 ? "ESTÁVEL" : "ATENÇÃO"}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Chance</span>
                <span className="text-white">{area.score}%</span>
              </div>
              <Progress value={area.score} className="h-1.5" indicatorClassName={area.color} />
            </div>

            <div className="mt-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Ver detalhes por tema</span>
              <ChevronRight className="h-3 w-3 text-indigo-400" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
