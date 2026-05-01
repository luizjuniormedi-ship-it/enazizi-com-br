import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Activity, Zap, ShieldCheck, History, Info, TrendingUp, Sparkles, Sliders, Check } from "lucide-react";
import { useAdaptiveJourney, useCognitiveHistory } from "@/hooks/useAdaptiveJourney";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CognitiveSessionController } from "@/components/CognitiveSessionController";

export default function MedicalAdaptiveJourney() {
  const { data: events, isLoading } = useAdaptiveJourney();
  const { data: history } = useCognitiveHistory();

  if (isLoading) return <div className="p-8 text-center">Mapeando sua jornada cognitiva...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Minha Jornada Adaptativa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transparência total sobre como o ACE ajusta seu aprendizado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Motor Ativo
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" /> Timeline de Ajustes
            </h3>
            {events?.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <p className="text-muted-foreground italic">Sua jornada ainda está sendo calibrada.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {events?.map((event) => (
                  <JourneyEventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <CognitiveSessionController />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Histórico de Stress
              </CardTitle>
            </CardHeader>
            <CardContent className="h-40 flex items-end gap-1 px-4">
              {/* Mock visualization of history */}
              {[40, 30, 25, 60, 45, 30, 20, 35, 15, 25].map((val, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-primary/20 rounded-t-sm transition-all hover:bg-primary/40"
                  style={{ height: `${val}%` }}
                />
              ))}
            </CardContent>
            <div className="px-4 pb-4 text-[10px] text-muted-foreground text-center">
              Variação de carga cognitiva nos últimos 7 dias
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" /> Intensidade ACE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2">
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
              <p className="text-[10px] text-muted-foreground mt-2">
                Define a frequência com que o motor ACE sugere mudanças de rota.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntensityOption({ label, description, active }: { label: string; description: string; active: boolean }) {
  return (
    <div className={cn(
      "p-3 rounded-lg border transition-all cursor-pointer",
      active ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : "bg-muted/30 hover:bg-muted/50"
    )}>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-bold", active ? "text-primary" : "text-foreground")}>{label}</span>
        {active && <Check className="h-3 w-3 text-primary" />}
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{description}</p>
    </div>
  );
}

function JourneyEventCard({ event }: { event: any }) {
  const triggerLabels: Record<string, string> = {
    quiz_error: "Dificuldade em Quiz",
    tutor_open: "Consulta ao Tutor",
    replay_spike: "Replay de Conteúdo",
    low_retention: "Queda de Retenção",
    default: "Ajuste de Rota"
  };

  const icons: Record<string, any> = {
    quiz_error: TrendingUp,
    tutor_open: Sparkles,
    replay_spike: Activity,
    low_retention: ShieldCheck,
    default: BrainCircuit
  };

  const Icon = icons[event.trigger_type] || icons.default;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          <div className="w-1 bg-primary" />
          <div className="p-4 flex-1 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{event.action_taken}</span>
                  <span className="text-[10px] text-muted-foreground">{triggerLabels[event.trigger_type] || event.trigger_type}</span>
                </div>
              </div>
              <Badge variant="secondary" className="text-[9px] uppercase tabular-nums">
                {new Date(event.created_at).toLocaleDateString()}
              </Badge>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
              <div className="flex items-start gap-2">
                <Info className="h-3 w-3 mt-0.5 text-primary" />
                <p className="text-xs leading-relaxed font-medium">
                  {event.explanation}
                </p>
              </div>
              {event.impact_summary && (
                <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                  <TrendingUp className="h-3 w-3 mt-0.5 text-emerald-500" />
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic">
                    Impacto: {event.impact_summary}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Fricção ACE</span>
                <Progress value={event.friction_score_snapshot * 100} className="w-12 h-1" />
              </div>
              <span className="text-[10px] text-muted-foreground italic">
                Decisão auditável: {event.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
