/**
 * Radar de Trajetória IA — Mappers para apresentação.
 */
import type {
  TrajectoryScenario,
  TrajectorySnapshot,
  Horizon,
  ScenarioType,
  Severity,
  EffortLevel,
} from "@/types/trajectory";

export const SCENARIO_LABEL: Record<ScenarioType, string> = {
  current: "Mantendo o ritmo atual",
  conservative: "Mais revisão, menos conteúdo novo",
  aggressive: "Aumentar volume e ritmo",
  recommended: "Recomendado pelo Radar",
};

export const SCENARIO_ORDER: ScenarioType[] = [
  "current",
  "conservative",
  "recommended",
  "aggressive",
];

export const HORIZON_LABEL: Record<Horizon, string> = {
  14: "14 dias",
  28: "28 dias",
  56: "56 dias",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: "Esforço baixo",
  medium: "Esforço médio",
  high: "Esforço alto",
};

export function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toString();
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function deltaTone(value: number | null | undefined): "positive" | "negative" | "neutral" {
  if (value == null || Number.isNaN(value) || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

export function confidenceLabel(score: number | null | undefined): "alta" | "média" | "baixa" {
  if (score == null) return "baixa";
  if (score >= 0.7) return "alta";
  if (score >= 0.4) return "média";
  return "baixa";
}

export function groupScenariosByHorizon(
  scenarios: TrajectoryScenario[]
): Record<Horizon, TrajectoryScenario[]> {
  const out: Record<Horizon, TrajectoryScenario[]> = { 14: [], 28: [], 56: [] };
  for (const s of scenarios) {
    if (s.horizonDays === 14 || s.horizonDays === 28 || s.horizonDays === 56) {
      out[s.horizonDays].push(s);
    }
  }
  for (const h of [14, 28, 56] as Horizon[]) {
    out[h].sort(
      (a, b) =>
        SCENARIO_ORDER.indexOf(a.scenarioType) - SCENARIO_ORDER.indexOf(b.scenarioType)
    );
  }
  return out;
}

export function snapshotHasEnoughData(snap: TrajectorySnapshot | null | undefined): boolean {
  if (!snap) return false;
  return snap.dataCompleteness !== "insufficient";
}
