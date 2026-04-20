import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, TrendingUp } from "lucide-react";
import { useStudyEngine } from "@/hooks/useStudyEngine";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";
import { trackAlertEvent } from "@/lib/alertTelemetry";

const PHASE_COLORS: Record<number, string> = {
  1: "text-destructive bg-destructive/10",
  2: "text-primary bg-primary/10",
  3: "text-accent-foreground bg-accent/50",
  4: "text-primary bg-primary/10",
};

const PHASE_MESSAGES: Record<number, string> = {
  1: "Hoje não é sobre fazer tudo. É sobre voltar ao controle.",
  2: "Cada revisão limpa é um passo de volta ao domínio.",
  3: "Seu ritmo está voltando. Continue assim!",
  4: "Quase lá! Você está retomando o controle total.",
};

export default function RecoveryModeBanner() {
  const { adaptive } = useStudyEngine();
  const { getDecision } = useAlertOrchestrator();

  if (!adaptive?.recoveryMode) return null;
  // Alert Orchestrator — respeita decisão central
  if (!getDecision("recovery").visible) return null;

  const hr = adaptive.heavyRecovery;

  // Heavy Recovery mode — detailed banner
  if (hr?.active) {
    const phaseColor = PHASE_COLORS[hr.phase] || PHASE_COLORS[1];
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${phaseColor}`}>
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold leading-snug">
                  Recuperação Pesada
                </p>
                <Badge variant="outline" className="text-[10px] py-0">
                  Fase {hr.phase}/4 — {hr.phaseLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hr.phaseDescription}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Dia {hr.dayInRecovery}/30</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {hr.progressPercent}%
              </span>
            </div>
            <Progress value={hr.progressPercent} className="h-1.5" />
          </div>

          <p className="text-xs text-muted-foreground/80 italic">
            {PHASE_MESSAGES[hr.phase]}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Standard recovery mode — simple banner
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">
            Modo recuperação ativo
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {adaptive.recoveryReason || "Vamos reorganizar seu plano para você retomar o ritmo."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}