/**
 * alertRules — geração pura de candidatos do Alert Orchestrator
 * ─────────────────────────────────────────────────────────────
 * Recebe um snapshot consolidado (approval, exam, recovery, fsrs, impact)
 * e devolve a lista bruta de candidatos. Toda decisão de "quando aparecer"
 * mora aqui — testável sem React.
 *
 * Não aplica dedupe nem caps — isso é responsabilidade do hook orquestrador.
 */
import type { AlertOrchestratorItem } from "@/types/alertOrchestrator";

export interface AlertRulesInput {
  // Exam date
  examDateMissing: boolean;
  examDateSnoozed: boolean;

  // Approval prediction (pode ser null se não há dados suficientes)
  approval: {
    riskLevel: "low" | "medium" | "high" | null;
    trend: "up" | "down" | "stable" | null;
    delta: number | null;
    score: number | null;
    hasEnoughData: boolean;
  } | null;

  // Coverage
  requiredCoveragePct: number;

  // Recovery
  recoveryActive: boolean;
  recoveryHeavyActive: boolean;
  recoveryReason?: string | null;

  // FSRS
  fsrsDue: number;

  // Inatividade
  questions7d: number;
  tasksCompleted7d: number;
  tasksCreated7d: number;
}

const SNOOZE_KEY = "exam_date_banner_snoozed_until";

/** Lê o snooze do localStorage (cliente). Defensivo para SSR. */
export function isExamDateSnoozed(): boolean {
  try {
    const v = Number(
      typeof window !== "undefined" && window.localStorage
        ? window.localStorage.getItem(SNOOZE_KEY)
        : 0
    );
    return v > Date.now();
  } catch {
    return false;
  }
}

export function buildCandidateAlerts(
  input: AlertRulesInput
): AlertOrchestratorItem[] {
  const out: AlertOrchestratorItem[] = [];

  // ── Exam date ausente
  if (input.examDateMissing && !input.examDateSnoozed) {
    out.push({
      id: "exam-date",
      source: "exam-date",
      title: "Informe a data da sua prova",
      message:
        "Para personalizar seu plano até a prova, precisamos saber quando você vai fazer.",
      priority: "critical",
      layer: "structural",
      visible: true,
      dedupeKey: "exam-date-missing",
      legacyOrigin: "core",
    });
  }

  // ── Recovery (heavy crítico, leve importante)
  if (input.recoveryActive) {
    out.push({
      id: "recovery",
      source: "recovery",
      title: input.recoveryHeavyActive
        ? "Recuperação Pesada"
        : "Modo recuperação ativo",
      message:
        input.recoveryReason ||
        "Vamos reorganizar seu plano para você retomar o ritmo.",
      priority: input.recoveryHeavyActive ? "critical" : "important",
      layer: "structural",
      visible: true,
      dedupeKey: "recovery-active",
      legacyOrigin: "core",
    });
  }

  // ── Approval prediction
  if (input.approval && input.approval.hasEnoughData) {
    const { riskLevel, trend, delta, score } = input.approval;

    if (riskLevel === "high" || (score !== null && score < 40)) {
      out.push({
        id: "approval-risk",
        source: "approval-risk",
        title: "Risco de aprovação alto",
        message: `⚠️ Com esse ritmo atual, sua aprovação está em risco (${score ?? 0}%)`,
        priority: "critical",
        layer: "structural",
        visible: true,
        actionLabel: "Ver detalhes",
        actionHref: "/dashboard/analytics",
        dedupeKey: "approval-risk",
        legacyOrigin: "core",
      });
    }

    if (trend === "down" && delta !== null && delta <= -3) {
      out.push({
        id: "approval-trend",
        source: "approval-trend",
        title: "Desempenho em queda",
        message: `📉 Seu desempenho está caindo nesta semana (${delta} pts)`,
        priority: "important",
        layer: "structural",
        visible: true,
        actionLabel: "Ver detalhes",
        actionHref: "/dashboard/analytics",
        dedupeKey: "approval-trend",
        legacyOrigin: "core",
      });
    }

    if (riskLevel === "medium" && input.requiredCoveragePct < 50) {
      out.push({
        id: "coverage-risk",
        source: "coverage-risk",
        title: "Cobertura obrigatória insuficiente",
        message: `🔥 Cobertura obrigatória insuficiente (${input.requiredCoveragePct}%)`,
        priority: "important",
        layer: "structural",
        visible: true,
        actionLabel: "Ver detalhes",
        actionHref: "/dashboard/analytics",
        dedupeKey: "coverage-risk",
        legacyOrigin: "core",
      });
    }
  }

  // ── FSRS backlog
  if (input.fsrsDue > 50) {
    out.push({
      id: "fsrs-backlog-structural",
      source: "fsrs-backlog",
      title: "Revisões pendentes",
      message: `Você tem ${input.fsrsDue} revisões pendentes`,
      priority: "important",
      layer: "structural",
      visible: true,
      actionLabel: "Revisar agora",
      actionHref: "/flashcards",
      dedupeKey: "fsrs-backlog",
      legacyOrigin: "core",
    });
  } else if (input.fsrsDue >= 20) {
    out.push({
      id: "fsrs-backlog-contextual",
      source: "fsrs-backlog",
      title: "Revisões acumulando",
      message: `Você tem ${input.fsrsDue} revisões a fazer`,
      priority: "contextual",
      layer: "contextual",
      visible: true,
      actionLabel: "Revisar",
      actionHref: "/flashcards",
      dedupeKey: "fsrs-backlog",
      legacyOrigin: "core",
    });
  }

  // ── Inatividade (7d sem questões)
  if (input.questions7d === 0) {
    out.push({
      id: "inactivity",
      source: "inactivity",
      title: "Sem prática há 7 dias",
      message: "Você está há 7 dias sem praticar questões",
      priority: "important",
      layer: "structural",
      visible: true,
      actionLabel: "Praticar",
      actionHref: "/banco-questoes",
      dedupeKey: "inactivity",
      legacyOrigin: "core",
    });
  }

  // ── Tasks não concluídas
  if (input.tasksCreated7d > 0 && input.tasksCompleted7d === 0) {
    out.push({
      id: "tasks-stale",
      source: "inactivity",
      title: "Tarefas pendentes",
      message: "Nenhuma tarefa foi concluída esta semana",
      priority: "contextual",
      layer: "contextual",
      visible: true,
      actionLabel: "Abrir cronograma",
      actionHref: "/cronograma",
      dedupeKey: "tasks-stale",
      legacyOrigin: "core",
    });
  }

  // ── Missão mínima (inatividade detectada)
  // O hook decide se vira structural (sem critical) ou contextual (com critical).
  if (input.questions7d === 0 || input.tasksCompleted7d === 0) {
    out.push({
      id: "min-mission",
      source: "min-mission",
      title: "Missão mínima de hoje",
      message: "Vamos destravar com algo simples: 10 questões + 1 revisão.",
      priority: "contextual",
      layer: "contextual",
      visible: true,
      actionLabel: "Começar missão mínima",
      actionHref: "/banco-questoes?mode=quick10",
      dedupeKey: "min-mission",
      legacyOrigin: "core",
    });
  }

  return out;
}
