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
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Simulados</p>
            <p className="text-lg font-bold">{totalSimulados}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alunos Atribuídos</p>
            <p className="text-lg font-bold">{totalStudentsAssigned}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Concluídos</p>
            <p className="text-lg font-bold">{totalCompleted}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Taxa Conclusão</p>
            <p className="text-lg font-bold">{conclusionRate}%</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default SimuladosKpiCards;
