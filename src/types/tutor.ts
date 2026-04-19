/**
 * Tutor IA V2 — Contrato de blocos pedagógicos estruturados.
 *
 * Substitui markdown puro por blocos tipados, mantendo compatibilidade
 * retroativa via fallback automático (markdown → DeepDiveBlock).
 *
 * Stream protocol: NDJSON, um TutorBlock por linha.
 * Fallback: se o backend retornar texto plano, embrulhar em deep_dive.
 */

// ============= Auxiliares =============

export interface TutorReference {
  source: string;
  url?: string;
  snippet?: string;
}

export type TutorActionKind =
  | "open_session"
  | "open_simulado"
  | "review_fsrs"
  | "open_mnemonic"
  | "open_topic"
  | "ask_followup";

export interface TutorAction {
  kind: TutorActionKind;
  label: string;
  payload?: Record<string, unknown>;
}

// ============= Blocos =============

export interface SummaryBlock {
  type: "summary";
  payload: { title: string; bullets: string[] };
}

export interface LayExplanationBlock {
  type: "lay_explanation";
  payload: { text: string; analogy?: string };
}

export interface DeepDiveBlock {
  type: "deep_dive";
  payload: { markdown: string; refs?: TutorReference[] };
}

export interface ComparisonTableBlock {
  type: "comparison_table";
  payload: {
    headers: string[];
    rows: string[][];
    caption?: string;
  };
}

export interface ClinicalFlowNode {
  id: string;
  label: string;
  kind?: "decision" | "action" | "outcome";
}

export interface ClinicalFlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ClinicalFlowBlock {
  type: "clinical_flow";
  payload: {
    title?: string;
    nodes: ClinicalFlowNode[];
    edges: ClinicalFlowEdge[];
  };
}

export interface MiniQuizBlock {
  type: "mini_quiz";
  payload: {
    stem: string;
    options: string[];
    correct_index: number;
    explanation: string;
    topic?: string;
    subtopic?: string;
  };
}

export interface MnemonicReinforceBlock {
  type: "mnemonic_reinforce";
  payload: {
    mnemonic_asset_id?: string;
    phrase: string;
    items: string[];
    topic?: string;
  };
}

export interface NextStepsBlock {
  type: "next_steps";
  payload: { actions: TutorAction[] };
}

export interface ReferenceBlock {
  type: "reference";
  payload: { refs: TutorReference[] };
}

export type TutorBlock =
  | SummaryBlock
  | LayExplanationBlock
  | DeepDiveBlock
  | ComparisonTableBlock
  | ClinicalFlowBlock
  | MiniQuizBlock
  | MnemonicReinforceBlock
  | NextStepsBlock
  | ReferenceBlock;

export type TutorBlockType = TutorBlock["type"];

// ============= Mensagem estruturada =============

export interface TutorStructuredMessage {
  role: "assistant";
  /** Mantido para compatibilidade com a UI legada (concat de markdown dos blocos). */
  content: string;
  blocks: TutorBlock[];
  meta?: {
    topic?: string;
    subtopic?: string;
    used_adaptive_context?: boolean;
    decision_id?: string;
  };
}

// ============= Protocolo de stream =============

export type TutorStreamFormat = "markdown" | "blocks";

/**
 * Embrulha texto markdown legado em um bloco deep_dive (fallback retro-compatível).
 */
export function wrapMarkdownAsBlock(markdown: string): DeepDiveBlock {
  return { type: "deep_dive", payload: { markdown } };
}

/**
 * Type guard para validar um TutorBlock recebido por SSE/NDJSON.
 * Tolerante: valida apenas a forma mínima (presença de `type` conhecido + payload objeto).
 */
export function isTutorBlock(value: unknown): value is TutorBlock {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown; payload?: unknown };
  if (typeof v.type !== "string") return false;
  if (typeof v.payload !== "object" || v.payload === null) return false;
  const known: TutorBlockType[] = [
    "summary",
    "lay_explanation",
    "deep_dive",
    "comparison_table",
    "clinical_flow",
    "mini_quiz",
    "mnemonic_reinforce",
    "next_steps",
    "reference",
  ];
  return (known as string[]).includes(v.type);
}

// ============= Eventos pedagógicos (tabela tutor_events) =============

export type TutorEventType =
  | "mini_quiz_answered"
  | "mini_quiz_correct"
  | "mini_quiz_incorrect"
  | "mnemonic_suggested"
  | "mnemonic_accepted"
  | "next_step_clicked"
  | "handoff_started"
  | "topic_mastered"
  | "reinforcement_saved"
  | "block_rendered";

export interface TutorEventInput {
  event_type: TutorEventType;
  conversation_id?: string;
  topic?: string;
  subtopic?: string;
  block_type?: TutorBlockType;
  payload?: Record<string, unknown>;
  outcome?: string;
  related_message_id?: string;
}
