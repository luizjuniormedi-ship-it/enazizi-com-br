import { Sliders } from "lucide-react";
import {
  STUDY_ENGINE_CALIBRATION,
  STUDY_ENGINE_CALIBRATION_MODE,
  STUDY_ENGINE_CALIBRATION_VERSION,
  getCalibrationLabel,
} from "@/lib/studyEngineCalibration";

/**
 * CalibrationStatusCard — leitura dos pesos atuais do motor adaptativo.
 * Apenas read-only (sem edição). Útil para auditoria e debug visual.
 */
const CalibrationStatusCard = () => {
  const cal = STUDY_ENGINE_CALIBRATION;
  const mode = STUDY_ENGINE_CALIBRATION_MODE;
  const label = getCalibrationLabel(mode);

  const tone =
    mode === "aggressive"
      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
      : mode === "conservative"
      ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
      : "text-primary bg-primary/10";

  const Item = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-md px-2 py-1.5 bg-muted/40">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );

  return (
    <div className="glass-card p-5 border-primary/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sliders className="h-4 w-4 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-sm truncate">Calibração do motor</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${tone}`}>
          {label}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Item label="🎯 Coverage boost" value={`+${cal.coverageGapBoost}`} />
        <Item label="📈 Meta boost" value={`+${cal.monthlyGoalBoost}`} />
        <Item label="📊 Goal V3 boost" value={`+${cal.questionGoalBehindBoost}`} />
        <Item label="⏱️ Reta final" value={`×${cal.examPressure.finalStretchMultiplier}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Item label="Cobertura baixa <" value={`${cal.thresholds.lowCoveragePct}%`} />
        <Item label="Backlog pesado >" value={cal.thresholds.heavyBacklog} />
        <Item label="Reta final ≤" value={`${cal.thresholds.finalStretchDays}d`} />
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground">
        Versão {STUDY_ENGINE_CALIBRATION_VERSION} · modo <span className="font-medium">{mode}</span>
      </div>
    </div>
  );
};

export default CalibrationStatusCard;
