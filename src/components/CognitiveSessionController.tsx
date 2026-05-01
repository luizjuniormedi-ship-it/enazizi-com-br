import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Zap, ShieldCheck, Activity, Coffee, Flame, AlertCircle } from "lucide-react";
import { useCognitiveOrchestrator, SessionMode } from "@/hooks/useCognitiveOrchestrator";
import { cn } from "@/lib/utils";

export function CognitiveSessionController() {
  const { data: state, updateMode, isPending } = useCognitiveOrchestrator();

  if (!state) return null;

  const modes: { id: SessionMode; label: string; icon: any; color: string; description: string }[] = [
    { 
      id: 'silent', 
      label: 'Silencioso', 
      icon: Coffee, 
      color: 'blue', 
      description: 'Foco total com o mínimo de interrupções adaptativas.' 
    },
    { 
      id: 'balanced', 
      label: 'Equilibrado', 
      icon: Activity, 
      color: 'emerald', 
      description: 'Ritmo padrão com suporte ACE otimizado.' 
    },
    { 
      id: 'intense', 
      label: 'Intenso', 
      icon: Flame, 
      color: 'orange', 
      description: 'Máxima pressão cognitiva para sessões de alta performance.' 
    },
    { 
      id: 'recovery', 
      label: 'Recuperação', 
      icon: ShieldCheck, 
      color: 'red', 
      description: 'Redução automática de carga para preservar sua retenção.' 
    }
  ];

  return (
    <Card className="border-primary/10 overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Orquestrador de Sessão
          </CardTitle>
          <Badge variant="outline" className="bg-background/50 font-mono text-[10px]">
            ACE V2.1
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {/* Status em Tempo Real */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
              <span>Stress</span>
              <span>{(state.stress_index * 100).toFixed(0)}%</span>
            </div>
            <Progress value={state.stress_index * 100} className="h-1" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
              <span>Fadiga</span>
              <span>{(state.fatigue_index * 100).toFixed(0)}%</span>
            </div>
            <Progress value={state.fatigue_index * 100} className="h-1" />
          </div>
        </div>

        {/* Seleção de Modo */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground px-1">Modo da Sessão</p>
          <div className="grid grid-cols-2 gap-2">
            {modes.map((m) => {
              const active = state.current_session_mode === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => updateMode.mutate(m.id)}
                  disabled={isPending}
                  className={cn(
                    "flex flex-col items-start p-2.5 rounded-xl border text-left transition-all",
                    active 
                      ? `bg-${m.color}-500/10 border-${m.color}-500/40 ring-1 ring-${m.color}-500/20` 
                      : "bg-muted/20 hover:bg-muted/40 border-transparent",
                    isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-3.5 w-3.5", active ? `text-${m.color}-500` : "text-muted-foreground")} />
                    <span className={cn("text-xs font-bold", active ? `text-${m.color}-600` : "text-foreground")}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">
                    {m.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerta de Recuperação */}
        {state.current_session_mode === 'recovery' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-pulse">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 leading-tight">
              <strong>Modo Recuperação Ativo:</strong> Detectamos fadiga cognitiva elevada. 
              O sistema reduziu a intensidade dos quizzes e priorizou revisões leves.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
