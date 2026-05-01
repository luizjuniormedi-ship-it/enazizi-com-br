import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Activity, ShieldCheck, Zap, Ghost, GraduationCap, AlertTriangle, TrendingUp, Info } from "lucide-react";
import { useMedicalMastery, MasteryMetric } from "@/hooks/useMedicalMastery";

export function MedicalMasteryDashboard() {
  const { data: metrics, isLoading } = useMedicalMastery();

  if (isLoading) return <div className="p-8 text-center">Calculando Maestria Clínica...</div>;
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <MasteryCard key={metric.node_name} metric={metric} />
        ))}
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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            {metric.node_name}
          </CardTitle>
          <Badge variant={averageScore > 80 ? "default" : "secondary"}>
            {averageScore.toFixed(0)}% Mastery
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> Teórico</span>
            <span>{(metric.theoretical_score * 100).toFixed(0)}%</span>
          </div>
          <Progress value={metric.theoretical_score * 100} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Clínico</span>
            <span>{(metric.clinical_score * 100).toFixed(0)}%</span>
          </div>
          <Progress value={metric.clinical_score * 100} className="h-1.5" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Estabilidade FSRS</span>
            <span>{(metric.retention_stability * 100).toFixed(0)}%</span>
          </div>
          <Progress value={metric.retention_stability * 100} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
          <div className="space-y-1">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" /> Velocidade
            </div>
            <div className="text-sm font-bold">{(metric.speed_factor * 100).toFixed(1)}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              <Ghost className="h-3 w-3" /> Tutor Depend.
            </div>
            <div className="text-sm font-bold">{(metric.dependency_factor * 100).toFixed(1)}%</div>
          </div>
        </div>

        {/* Predictive Layer */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Projeções Preditivas</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded-lg bg-muted/30 border space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-medium text-muted-foreground">Retenção Estimada</span>
                <span className="text-xs font-bold text-emerald-600">{(metric.retention_projection * 100).toFixed(0)}%</span>
              </div>
              <Progress value={metric.retention_projection * 100} className="h-1" />
            </div>

            <div className={cn(
              "p-2 rounded-lg border space-y-1",
              metric.overload_risk > 0.6 ? "bg-red-500/10 border-red-200" : "bg-muted/30 border-transparent"
            )}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-medium text-muted-foreground">Risco de Sobrecarga</span>
                <span className={cn("text-xs font-bold", metric.overload_risk > 0.6 ? "text-red-600" : "text-muted-foreground")}>
                  {(metric.overload_risk * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={metric.overload_risk * 100} className={cn("h-1", metric.overload_risk > 0.6 ? "bg-red-200" : "")} />
            </div>
          </div>

          {metric.false_mastery_risk > 0.4 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-200/50">
              <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
              <p className="text-[9px] text-amber-700 leading-tight italic">
                <strong>Alerta de Falsa Maestria:</strong> Seu desempenho em temas correlatos sugere que a fixação deste conceito pode ser apenas temporária. ACE sugeriu reforço multimodal.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
