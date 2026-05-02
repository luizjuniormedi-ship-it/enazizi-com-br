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
      <div className="card-pixar bg-destructive/10 border-destructive/20 relative overflow-hidden">
        <div className="p-6 space-y-6 relative z-10">
          <div className="flex items-start gap-5">
            <div className={`p-4 rounded-2xl shrink-0 shadow-[0_0_30px_rgba(239,68,68,0.4)] ${phaseColor} animate-pulse-slow border border-destructive/30`}>
              <Shield className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[16px] font-black tracking-tighter uppercase text-destructive drop-shadow-sm">
                  Protocolo de Recuperação Crítica
                </p>
                <Badge variant="destructive" className="text-[10px] font-black py-0.5 h-6 px-3 rounded-full border-0 bg-destructive text-white shadow-lg">
                  Fase {hr.phase}/4 · {hr.phaseLabel}
                </Badge>
              </div>
              <p className="text-[14px] font-bold text-white/70 mt-2 leading-relaxed italic">
                {hr.phaseDescription}
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-white/5 p-4 rounded-3xl border border-white/5 shadow-inner">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              <span>Dia {hr.dayInRecovery}/30 na jornada de resgate</span>
              <span className="flex items-center gap-1.5 text-destructive animate-pulse">
                <TrendingUp className="h-4 w-4" />
                {hr.progressPercent}% recuperado
              </span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-destructive transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                style={{ width: `${hr.progressPercent}%` }} 
              />
            </div>
          </div>

          <div className="bg-destructive/5 rounded-2xl p-4 border-l-4 border-destructive/50">
            <p className="text-[13px] text-white/80 italic font-bold leading-relaxed">
              "{PHASE_MESSAGES[hr.phase]}"
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Standard recovery mode — compacto em mobile, completo em ≥sm
  return (
    <div className="card-pixar bg-primary/5 border-primary/20">
      {/* Mobile: linha única discreta */}
      <div className="sm:hidden px-4 py-3 flex items-center gap-3">
        <Shield className="h-4 w-4 text-[#00d2ff] shrink-0 animate-pulse" />
        <p className="text-xs font-bold text-white/70 truncate uppercase tracking-wider">
          <span className="text-white">Recuperação ativa</span>
          {adaptive.recoveryReason ? ` · ${adaptive.recoveryReason}` : ""}
        </p>
      </div>
      {/* ≥sm: layout original */}
      <div className="hidden sm:flex p-5 items-center gap-4">
        <div className="p-3 rounded-2xl bg-[#00d2ff]/20 shrink-0 border border-[#00d2ff]/30 shadow-[0_0_20px_rgba(0,210,255,0.2)]">
          <Shield className="h-6 w-6 text-[#00d2ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black uppercase tracking-widest text-white leading-snug">
            Modo recuperação ativo
          </p>
          <p className="text-[13px] font-bold text-white/50 mt-1">
            {adaptive.recoveryReason || "Vamos reorganizar seu plano para você retomar o ritmo."}
          </p>
        </div>
      </div>
    </div>
  );
}