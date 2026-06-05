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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Indicador ENAMED 2026</p>
            <h3 className="text-4xl font-black text-white">Chance de Aprovação</h3>
            <p className="text-slate-400 max-w-md">Calculado com base na sua performance real vs. incidência histórica e peso curricular.</p>
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
                <Badge variant="outline" className="mt-1 bg-white/5 border-white/10 text-[8px] font-bold">
                  {getLabelText(enamed.readinessLabel)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Areas List */}
      <div className="space-y-3">
        {enamed.strongAreas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest w-full mb-1">Áreas de Domínio</span>
            {enamed.strongAreas.map(area => (
              <Badge key={area} variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                {area}
              </Badge>
            ))}
          </div>
        )}

        {enamed.weakAreas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest w-full mb-1">Gargalos Críticos</span>
            {enamed.weakAreas.map(area => (
              <Badge key={area} variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">
                {area}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
        <AlertCircle className="h-4 w-4 text-indigo-400" />
        <p className="text-xs text-slate-300">{enamed.insight}</p>
      </div>
    </div>
  );
};
