import { Heart, Clock, Star, AlertTriangle, Shield, Activity, Zap, Monitor } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface ShiftHeaderProps {
  patientStatus: string;
  statusAlert: boolean;
  countdown: number;
  /** Total seconds the case started with — used to scale the progress bar correctly per difficulty. */
  initialCountdown?: number;
  timerExpired: boolean;
  score: number;
  scoreFlash: "green" | "red" | null;
  triageColor: string;
  setting: string;
  inactivityWarning: boolean;
  abcdeChecklist: Record<string, boolean>;
  onToggleMultiView?: () => void;
  onToggleStressTest?: () => void;
  showMultiView?: boolean;
  showStressTest?: boolean;
}

const TRIAGE_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  vermelho: { bg: "bg-red-500/10", border: "border-red-500/40", text: "text-red-400", label: "Emergência" },
  laranja: { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-400", label: "Muito Urgente" },
  amarelo: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", label: "Urgente" },
  verde: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", label: "Pouco Urgente" },
};

const STATUS_CONFIG: Record<string, { color: string; pulse: boolean }> = {
  estável: { color: "text-emerald-400", pulse: false },
  instável: { color: "text-amber-400", pulse: false },
  grave: { color: "text-orange-400", pulse: true },
  crítico: { color: "text-red-400", pulse: true },
};

export default function ShiftHeader({
  patientStatus, statusAlert, countdown, initialCountdown, timerExpired,
  score, scoreFlash, triageColor, setting, inactivityWarning,
  abcdeChecklist,
  onToggleMultiView, onToggleStressTest, showMultiView, showStressTest
}: ShiftHeaderProps) {
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const triage = TRIAGE_CONFIG[triageColor] || TRIAGE_CONFIG.amarelo;
  const status = STATUS_CONFIG[patientStatus] || STATUS_CONFIG.estável;
  const baseTimer = initialCountdown && initialCountdown > 0 ? initialCountdown : 30 * 60;
  const timerPercent = countdown > 0 ? Math.min(100, (countdown / baseTimer) * 100) : 0;
  const timerCritical = countdown <= 120;
  const timerWarning = countdown <= 300;
  const abcdeCount = Object.values(abcdeChecklist).filter(Boolean).length;

  return (
    <div className={`border-b transition-all ${statusAlert ? "border-red-500/50 bg-red-500/5" : "border-border/50 bg-background/95"} backdrop-blur-sm`}>
      {/* Triage color bar */}
      <div className={`h-1 ${
        triageColor === "vermelho" ? "bg-red-500" :
        triageColor === "laranja" ? "bg-orange-500" :
        triageColor === "amarelo" ? "bg-amber-500" :
        "bg-emerald-500"
      }`} />

      <div className="px-3 py-2">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Setting + triage */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" />
              <span className="text-sm font-bold">Plantão</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${triage.bg} ${triage.border} ${triage.text}`}>
              {triage.label}
            </div>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">📍 {setting}</span>
            <div className="flex gap-1 ml-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleMultiView}
                className={`h-7 w-7 ${showMultiView ? 'bg-primary/20 text-primary' : 'text-white/20'}`}
                title="Hospital View (12 Pacientes)"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleStressTest}
                className={`h-7 w-7 ${showStressTest ? 'bg-yellow-500/20 text-yellow-500' : 'text-white/20'}`}
                title="Chaos Mode (Stress Test)"
              >
                <Zap className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right: Status indicators */}
          <div className="flex items-center gap-3">
            {/* ABCDE mini */}
            <div className="hidden md:flex items-center gap-0.5">
              {["A", "B", "C", "D", "E"].map((step) => (
                <span
                  key={step}
                  className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                    abcdeChecklist[step]
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-muted/30 text-muted-foreground/40 border border-border/30"
                  }`}
                >
                  {step}
                </span>
              ))}
            </div>

            {/* Patient status */}
            <div className={`flex items-center gap-1.5 ${statusAlert ? "animate-pulse" : ""}`}>
              <Heart className={`h-3.5 w-3.5 ${status.color} ${status.pulse ? "animate-pulse" : ""}`} />
              <span className={`text-xs font-bold capitalize ${status.color}`}>{patientStatus}</span>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
              timerExpired ? "border-red-500/40 bg-red-500/10" :
              timerCritical ? "border-red-500/30 bg-red-500/5 animate-pulse" :
              timerWarning ? "border-amber-500/30 bg-amber-500/5" :
              "border-border/30 bg-muted/20"
            }`}>
              <Clock className={`h-3.5 w-3.5 ${
                timerExpired || timerCritical ? "text-red-400" :
                timerWarning ? "text-amber-400" : "text-muted-foreground"
              }`} />
              <span className={`text-sm font-black font-mono tabular-nums ${
                timerExpired || timerCritical ? "text-red-400" :
                timerWarning ? "text-amber-400" : "text-foreground"
              }`}>
                {timerExpired ? "00:00" : formatCountdown(countdown)}
              </span>
            </div>

            {/* Score */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              scoreFlash === "green" ? "border-emerald-500/40 bg-emerald-500/10" :
              scoreFlash === "red" ? "border-red-500/40 bg-red-500/10" :
              "border-border/30 bg-muted/20"
            }`}>
              <Star className={`h-3.5 w-3.5 ${
                scoreFlash === "green" ? "text-emerald-400" :
                scoreFlash === "red" ? "text-red-400" :
                "text-amber-400"
              }`} />
              <span className="text-sm font-black font-mono tabular-nums">{score}</span>
            </div>
          </div>
        </div>

        {/* Timer progress bar */}
        <div className="mt-1.5">
          <Progress
            value={timerPercent}
            className={`h-0.5 ${
              timerCritical ? "[&>div]:bg-red-500" :
              timerWarning ? "[&>div]:bg-amber-500" :
              "[&>div]:bg-primary"
            }`}
          />
        </div>

        {/* Inactivity warning */}
        {inactivityWarning && (
          <div className="mt-1.5 flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-pulse">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400">Paciente aguardando conduta — aja agora!</span>
          </div>
        )}
      </div>
    </div>
  );
}
