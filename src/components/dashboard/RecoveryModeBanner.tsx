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
  const trackedRef = useRef(false);

  const recoveryActive = !!adaptive?.recoveryMode;
  const decisionVisible = recoveryActive && getDecision("recovery").visible;

  // Telemetria de exposição (1× por sessão de visibilidade)
  useEffect(() => {
    if (!decisionVisible || trackedRef.current) return;
    trackedRef.current = true;
    const heavyActive = !!adaptive?.heavyRecovery?.active;
    trackAlertEvent({
      alert: {
        id: heavyActive ? "recovery-heavy-banner" : "recovery-banner",
        source: "recovery",
        priority: heavyActive ? "critical" : "important",
        layer: "structural",
        legacyOrigin: "core",
        viaBridge: false,
      },
      eventType: "clicked",
      extra: { phase: adaptive?.heavyRecovery?.phase ?? null, autoExposureSignal: true },
    });
  }, [decisionVisible, adaptive]);

  if (!recoveryActive) return null;
  // Alert Orchestrator — respeita decisão central
  if (!decisionVisible) return null;

  const hr = adaptive.heavyRecovery;

  // Heavy Recovery mode — detailed banner
  if (hr?.active) {
    const phaseColor = PHASE_COLORS[hr.phase] || PHASE_COLORS[1];
    return (
      <Card className="border-destructive/20 bg-destructive/5 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 shadow-sm ${phaseColor} animate-pulse-slow`}>
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="text-[15px] font-black tracking-tight uppercase text-destructive">
                  Modo de Recuperação Pesada
                </p>
                <Badge variant="destructive" className="text-[10px] font-bold py-0 h-5 px-2 rounded-lg border-0 bg-destructive text-destructive-foreground">
                  Fase {hr.phase}/4 — {hr.phaseLabel}
                </Badge>
              </div>
              <p className="text-[13px] font-medium text-muted-foreground mt-1 leading-relaxed">
                {hr.phaseDescription}
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              <span>Dia {hr.dayInRecovery}/30 na jornada de resgate</span>
              <span className="flex items-center gap-1.5 text-destructive">
                <TrendingUp className="h-3.5 w-3.5" />
                {hr.progressPercent}% recuperado
              </span>
            </div>
            <Progress value={hr.progressPercent} className="h-2 rounded-full bg-destructive/10" />
          </div>

          <p className="text-[12px] text-muted-foreground/70 italic font-medium border-l-2 border-destructive/30 pl-3 py-0.5">
            "{PHASE_MESSAGES[hr.phase]}"
          </p>
        </CardContent>
      </Card>
    );
  }

  // Standard recovery mode — compacto em mobile, completo em ≥sm
  return (
    <Card className="border-primary/20 bg-primary/5">
      {/* Mobile: linha única discreta (sem ícone grande, sem subtitle) */}
      <CardContent className="sm:hidden px-3 py-2 flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground truncate">
          <span className="font-medium text-foreground">Recuperação ativa</span>
          {adaptive.recoveryReason ? ` · ${adaptive.recoveryReason}` : ""}
        </p>
      </CardContent>
      {/* ≥sm: layout original */}
      <CardContent className="hidden sm:flex p-4 items-center gap-3">
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