import { TutorBlock } from "@/types/tutor";
import { Badge } from "@/components/ui/badge";
import { Zap, Target, TrendingUp, ArrowUpRight } from "lucide-react";

interface Props {
  block: TutorBlock & { type: "curriculum_impact" };
}

export function CurriculumImpactBlock({ block }: Props) {
  const { theme, incidence, impact_score, mastery_level, priority, potential_gain } = block.payload;

  const incidenceLabel = incidence.toUpperCase();
  const incidenceColor = 
    incidence === "alta" ? "bg-red-50 text-red-600 border-red-200" :
    incidence === "media" ? "bg-orange-50 text-orange-600 border-orange-200" :
    "bg-blue-50 text-blue-600 border-blue-200";

  return (
    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-background to-primary/5 border border-primary/20 shadow-xl overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Target className="h-32 w-32" />
      </div>
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-black text-lg tracking-tight uppercase">Impacto Curricular</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tema</span>
            <p className="font-bold text-sm leading-tight">{theme}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Incidência ENAMED</span>
            <div>
              <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-black ${incidenceColor}`}>
                {incidenceLabel}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-primary/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Impacto</span>
              <span className="text-sm font-black text-primary flex items-center gap-1">
                <Zap className="h-3 w-3 fill-primary" />
                {impact_score}/10
              </span>
            </div>
            <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000" 
                style={{ width: `${impact_score * 10}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-end justify-center">
            <span className="text-[10px] font-black uppercase text-muted-foreground mb-1">Prioridade Geral</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-black tabular-nums tracking-tighter ${priority > 80 ? 'text-red-600' : 'text-primary'}`}>
                {priority}
              </span>
            </div>
          </div>
        </div>

        {potential_gain && (
          <div className="mt-4 pt-4 border-t border-primary/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Ganho estimado no Readiness</span>
            </div>
            <span className="text-sm font-black text-emerald-500">+{potential_gain.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
