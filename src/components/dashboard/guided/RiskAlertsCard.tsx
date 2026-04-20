/**
 * RiskAlertsCard — consome o Alert Orchestrator
 * ──────────────────────────────────────────────
 * Renderiza os alertas estruturais cuja `source` pertence ao escopo de risco
 * deste card (approval/coverage/fsrs/inactivity). A lógica de dedupe e
 * supressão (incluindo "data de prova ausente") é resolvida pelo orchestrator.
 *
 * Comportamento visual mantido idêntico ao card anterior (cap 3, tons danger/warn).
 */
import {
  AlertTriangle,
  Flame,
  TrendingDown,
  CalendarX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAlertOrchestrator } from "@/hooks/useAlertOrchestrator";
import type {
  AlertOrchestratorItem,
  AlertSource,
} from "@/types/alertOrchestrator";

const SCOPE: AlertSource[] = [
  "approval-risk",
  "approval-trend",
  "coverage-risk",
  "fsrs-backlog",
  "inactivity",
];

function iconFor(source: AlertSource) {
  switch (source) {
    case "approval-risk":
      return AlertTriangle;
    case "approval-trend":
      return TrendingDown;
    case "coverage-risk":
      return Flame;
    case "fsrs-backlog":
      return Flame;
    case "inactivity":
      return AlertTriangle;
    default:
      return AlertTriangle;
  }
}

function toneFor(item: AlertOrchestratorItem): "danger" | "warn" {
  return item.priority === "critical" ? "danger" : "warn";
}

export default function RiskAlertsCard() {
  const { structuralAlerts, contextualAlerts } = useAlertOrchestrator();

  // Coleta candidatos visíveis dentro do escopo do card.
  // O orchestrator já dedupa "exam-date-missing" mantendo só o banner próprio.
  const inScope = [...structuralAlerts, ...contextualAlerts].filter((a) =>
    SCOPE.includes(a.source as AlertSource)
  );

  if (inScope.length === 0) return null;

  const visible = inScope.slice(0, 3);

  return (
    <div className="space-y-1.5">
      {visible.map((a) => {
        const Icon = iconFor(a.source as AlertSource);
        const tone = toneFor(a);
        const cls =
          tone === "danger"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
        const inner = (
          <div
            className={`flex items-start gap-2 text-xs rounded-md px-2.5 py-2 border ${cls}`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-tight">{a.message}</span>
          </div>
        );
        return a.actionHref ? (
          <Link
            key={a.id}
            to={a.actionHref}
            className="block hover:opacity-80 transition-opacity"
          >
            {inner}
          </Link>
        ) : (
          <div key={a.id}>{inner}</div>
        );
      })}
    </div>
  );
}

// Suprime warning de import não-usado quando ícones específicos não disparam.
void CalendarX;
