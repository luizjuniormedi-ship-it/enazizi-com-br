/**
 * Alert Orchestrator — tipos puros
 * ─────────────────────────────────
 * Fonte única de verdade dos níveis de prioridade, camadas e shape do
 * item de alerta. Mantido fora do hook para evitar dependência circular
 * com a `lib/alertRules` (que só importa tipos).
 */

export type AlertPriority =
  | "critical"
  | "important"
  | "contextual"
  | "informational";

export type AlertLayer =
  | "structural"   // banners principais do dashboard
  | "contextual"   // cards de decisão / blocos intermediários
  | "ephemeral"    // toast, snackbar, sucesso, erro rápido
  | "deep";        // popup, modal, onboarding, dialogs

/**
 * Identificadores semânticos das fontes de alerta. Usados também como
 * chave de lookup no `getDecision(source)`.
 */
export type AlertSource =
  | "exam-date"
  | "approval-risk"
  | "approval-trend"
  | "coverage-risk"
  | "recovery"
  | "inactivity"
  | "fsrs-backlog"
  | "min-mission"
  | "achievement"
  | "onboarding-popup"
  | "install-app"
  | "whats-new"
  | "feedback-survey"
  | "system-guide"
  | "ephemeral-toast"
  | "intervention"
  // strings adicionais reservadas para integrações futuras
  | (string & {});

/** Origem técnica do alerta — usada apenas pelo painel de debug. */
export type AlertLegacyOrigin =
  | "core"
  | "smart-legacy"
  | "toast-legacy"
  | "popup-legacy"
  | "achievement"
  | "onboarding"
  | "bridge-ephemeral"
  | "bridge-deep";

export interface AlertOrchestratorItem {
  id: string;
  source: AlertSource;
  title?: string;
  message: string;
  priority: AlertPriority;
  layer: AlertLayer;
  visible: boolean;
  actionLabel?: string;
  actionHref?: string;
  dismissible?: boolean;
  /** Chave para deduplicar alertas semanticamente equivalentes. */
  dedupeKey?: string;
  /** Se `visible === false`, indica qual regra suprimiu (auditoria). */
  suppressedBy?: string;
  /** Origem técnica (debug-only). */
  legacyOrigin?: AlertLegacyOrigin;
  /** Indica se o alerta entrou via bridge (ephemeral/deep). */
  viaBridge?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AlertDecision {
  visible: boolean;
  priority: AlertPriority | null;
  layer: AlertLayer | null;
  suppressedBy?: string;
}

/** Ordem numérica para ordenação (maior = mais prioritário). */
export const PRIORITY_RANK: Record<AlertPriority, number> = {
  critical: 4,
  important: 3,
  contextual: 2,
  informational: 1,
};

/** Caps por camada conforme regra de exibição. */
export const LAYER_CAPS: Record<AlertLayer, number> = {
  structural: 2,
  contextual: 2,
  ephemeral: Infinity,
  deep: 1,
};
