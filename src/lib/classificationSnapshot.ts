/**
 * Snapshot helpers for classify-question-hierarchy real batch runs.
 * Captures the state of questions_bank + queue + runs before/after a real batch
 * so we can compute deltas and show impact transparently.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ClassificationSnapshot {
  ts: string;
  table_source: string;
  total_questions: number;
  with_specialty_id: number;
  with_topic_id: number;
  with_subtopic_id: number;
  queue_pending: number;
  total_runs: number;
}

export interface SnapshotDelta {
  questions: number;
  specialty: number;
  topic: number;
  subtopic: number;
  queue: number;
  runs: number;
}

const PRE_KEY = "classification_runner:last_pre_real_snapshot";
const POST_KEY = "classification_runner:last_post_real_snapshot";

async function countTotal(table: "questions_bank" | "real_exam_questions") {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
  return count ?? 0;
}

async function countNotNull(
  table: "questions_bank" | "real_exam_questions",
  column: "specialty_id" | "topic_id" | "subtopic_id",
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .not(column, "is", null);
  return count ?? 0;
}

export async function captureSnapshot(
  tableSource: "questions_bank" | "real_exam_questions",
): Promise<ClassificationSnapshot> {
  const [total, sp, tp, st, queueRes, runsRes] = await Promise.all([
    countTotal(tableSource),
    countNotNull(tableSource, "specialty_id"),
    countNotNull(tableSource, "topic_id"),
    countNotNull(tableSource, "subtopic_id"),
    supabase
      .from("question_classification_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("question_classification_runs").select("id", { count: "exact", head: true }),
  ]);

  return {
    ts: new Date().toISOString(),
    table_source: tableSource,
    total_questions: total,
    with_specialty_id: sp,
    with_topic_id: tp,
    with_subtopic_id: st,
    queue_pending: queueRes.count ?? 0,
    total_runs: runsRes.count ?? 0,
  };
}

export function savePreSnapshot(snap: ClassificationSnapshot) {
  try {
    localStorage.setItem(PRE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function savePostSnapshot(snap: ClassificationSnapshot) {
  try {
    localStorage.setItem(POST_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function loadPreSnapshot(): ClassificationSnapshot | null {
  try {
    const raw = localStorage.getItem(PRE_KEY);
    return raw ? (JSON.parse(raw) as ClassificationSnapshot) : null;
  } catch {
    return null;
  }
}

export function loadPostSnapshot(): ClassificationSnapshot | null {
  try {
    const raw = localStorage.getItem(POST_KEY);
    return raw ? (JSON.parse(raw) as ClassificationSnapshot) : null;
  } catch {
    return null;
  }
}

export function computeDelta(
  before: ClassificationSnapshot,
  after: ClassificationSnapshot,
): SnapshotDelta {
  return {
    questions: after.total_questions - before.total_questions,
    specialty: after.with_specialty_id - before.with_specialty_id,
    topic: after.with_topic_id - before.with_topic_id,
    subtopic: after.with_subtopic_id - before.with_subtopic_id,
    queue: after.queue_pending - before.queue_pending,
    runs: after.total_runs - before.total_runs,
  };
}

export function buildRollbackSql(params: {
  tableSource: string;
  startedAt: string;
  finishedAt: string;
  runId?: string | null;
}) {
  const { tableSource, startedAt, finishedAt, runId } = params;
  const rollbackQuestions = `-- Rollback de classificações aplicadas pelo lote real
-- Janela: ${startedAt}  →  ${finishedAt}
UPDATE public.${tableSource}
SET specialty_id = NULL,
    topic_id = NULL,
    subtopic_id = NULL,
    microtopic_id = NULL,
    classification_confidence = NULL,
    classification_method = NULL,
    classified_at = NULL
WHERE classification_reviewed_by_human = false
  AND classified_at >= '${startedAt}'
  AND classified_at <= '${finishedAt}';`;

  const rollbackQueue = runId
    ? `-- Rollback dos itens enviados para fila por essa run
DELETE FROM public.question_classification_queue
WHERE run_id = '${runId}'
  AND status = 'pending';`
    : `-- (sem run_id — não é seguro deletar a queue pelo timestamp sozinho)`;

  const rollbackRun = runId
    ? `-- Marcar a run como revertida (não deleta)
UPDATE public.question_classification_runs
SET status = 'rolled_back',
    notes = COALESCE(notes,'') || ' [rolled back manually at ' || now() || ']'
WHERE id = '${runId}';`
    : `-- (sem run_id — pulado)`;

  return [rollbackQuestions, rollbackQueue, rollbackRun].join("\n\n");
}
