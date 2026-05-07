import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, CheckCircle, BarChart3 } from "lucide-react";

interface Props {
  totalSimulados: number;
  totalStudentsAssigned: number;
  totalCompleted: number;
}

/**
 * KPIs estáticos da aba Simulados.
 * Memoizado: só re-renderiza quando algum dos 3 números muda.
 */
const SimuladosKpiCards = memo(function SimuladosKpiCards({
  totalSimulados,
  totalStudentsAssigned,
  totalCompleted,
}: Props) {
  const conclusionRate =
    totalStudentsAssigned > 0
      ? Math.round((totalCompleted / totalStudentsAssigned) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card className="bg-white/5 border-white/5 rounded-2xl shadow-glow-sm transition-transform hover:scale-[1.02]">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/20 flex items-center justify-center shadow-inner">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Simulados</p>
            <p className="text-xl font-black text-white">{totalSimulados}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/5 rounded-2xl shadow-glow-sm transition-transform hover:scale-[1.02]">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/20 flex items-center justify-center shadow-inner">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Alunos Atribuídos</p>
            <p className="text-xl font-black text-white">{totalStudentsAssigned}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/5 rounded-2xl shadow-glow-sm transition-transform hover:scale-[1.02]">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-amber-500/20 flex items-center justify-center shadow-inner">
            <CheckCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Concluídos</p>
            <p className="text-xl font-black text-white">{totalCompleted}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/5 rounded-2xl shadow-glow-sm transition-transform hover:scale-[1.02]">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-accent/20 flex items-center justify-center shadow-inner">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Taxa Conclusão</p>
            <p className="text-xl font-black text-white">{conclusionRate}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default SimuladosKpiCards;
