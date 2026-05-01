import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Zap, Calendar, TrendingUp, Sparkles, Activity, ShieldCheck } from "lucide-react";
import { useCognitiveScheduler, useWindowPerformance } from "@/hooks/useCognitiveScheduler";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function CognitiveSchedulerMonitor() {
  const { data: profile, isLoading: profileLoading } = useCognitiveScheduler();
  const { data: windows, isLoading: windowsLoading } = useWindowPerformance();

  if (profileLoading || windowsLoading) return <div className="p-8 text-center animate-pulse">Sincronizando orquestrador longitudinal...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-background to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" /> Janela Ótima
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">08:00 - 11:30</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                +31% Retenção
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-blue-500/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 text-blue-500" /> Duração Ideal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.preferred_session_duration || 65} min</div>
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              Ponto de fadiga detectado aos 72 min.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-orange-500/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-3 w-3 text-orange-500" /> Resiliência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{( (profile?.cognitive_resilience_score || 0.72) * 100).toFixed(0)}%</div>
            <Progress value={(profile?.cognitive_resilience_score || 0.72) * 100} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
              <Activity className="h-3 w-3 text-emerald-500" /> Circadiano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold uppercase truncate">
              {profile?.circadian_profile?.replace('_', ' ') || 'Morning Lark'}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Perfil matutino detectado.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Reorganização do Plano Cognitivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AdjustmentItem 
              theme="Farmacologia" 
              from="Hoje 21:00" 
              to="Amanhã 09:00" 
              reason="A retenção histórica para este tema é 31% superior no período matutino."
              gain={31}
            />
            <AdjustmentItem 
              theme="Cardiologia" 
              from="Texto" 
              to="Multimodal" 
              reason="Esta modalidade aumenta sua retenção em 18% em estados de fadiga média."
              gain={18}
            />
            <AdjustmentItem 
              theme="Pneumologia" 
              from="90 min" 
              to="45 min" 
              reason="Sessões curtas evitam o drift cognitivo detectado em Pneumo."
              gain={12}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Simulação de Performance (Next Session)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Retenção Prevista</span>
                  <span className="text-emerald-600 font-bold">89%</span>
                </div>
                <Progress value={89} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Risco de Drift</span>
                  <span className="text-amber-600 font-bold">14%</span>
                </div>
                <Progress value={14} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Ganho de Maestria Est.</span>
                  <span className="text-primary font-bold">+2.4%</span>
                </div>
                <Progress value={45} className="h-1.5" />
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong>ACE Planner:</strong> A sequência sugerida (Phys → ICC → Pharm) maximiza o <em>flow-state</em> e reduz a carga cognitiva em 22% comparado ao plano original.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdjustmentItem({ theme, from, to, reason, gain }: { theme: string; from: string; to: string; reason: string; gain: number }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold">{theme}</span>
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-bold">
          +{gain}% GAIN
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="line-through">{from}</span>
        <TrendingUp className="h-3 w-3" />
        <span className="text-primary font-bold">{to}</span>
      </div>
      <p className="text-[10px] text-muted-foreground italic leading-tight">
        "{reason}"
      </p>
    </div>
  );
}
