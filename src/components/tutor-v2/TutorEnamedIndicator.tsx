import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Target, Info } from "lucide-react";
import { getThemeWeights } from "@/lib/enamedIntelligence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const TutorEnamedIndicator = ({ theme }: { theme: string }) => {
  const [weights, setWeights] = useState<any>(null);

  useEffect(() => {
    if (theme) {
      getThemeWeights(theme).then(setWeights);
    }
  }, [theme]);

  if (!weights) return null;

  const isHighIncidence = weights.historical_incidence >= 8;
  const isLowIncidence = weights.historical_incidence <= 3;

  return (
    <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 animate-in fade-in slide-in-from-top-1">
      <div className="flex items-center gap-1.5">
        <Target className={`h-3.5 w-3.5 ${isHighIncidence ? "text-red-400" : "text-indigo-400"}`} />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/70">Contexto ENAMED:</span>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`text-[9px] font-bold border-none ${
                isHighIncidence ? "bg-red-500/10 text-red-400" : 
                isLowIncidence ? "bg-slate-500/10 text-slate-400" : 
                "bg-indigo-500/10 text-indigo-400"
              }`}
            >
              {isHighIncidence ? "ALTA INCIDÊNCIA" : isLowIncidence ? "BAIXA RECORRÊNCIA" : "INCIDÊNCIA MÉDIA"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border-white/10 text-[10px] max-w-[200px]">
            {isHighIncidence 
              ? "Este tema aparece com frequência altíssima nas últimas provas. Domínio obrigatório." 
              : isLowIncidence 
              ? "Este tema tem aparecido pouco recentemente. Foco em conceitos fundamentais." 
              : "Tema com presença regular nas provas ENAMED."}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center gap-1 ml-auto">
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 w-2 rounded-full ${i < Math.round(weights.historical_incidence / 2) ? (isHighIncidence ? 'bg-red-500' : 'bg-indigo-500') : 'bg-white/10'}`} 
            />
          ))}
        </div>
        <span className="text-[9px] font-bold text-white/40 ml-1">{weights.historical_incidence}/10</span>
      </div>
    </div>
  );
};
