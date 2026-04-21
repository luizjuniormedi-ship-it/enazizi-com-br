/**
 * Shared pure helpers for proficiency-planner.
 *
 * Extraído da edge function `index.ts` para permitir testes unitários
 * determinísticos sem necessidade de Deno runtime nem mock do Supabase.
 *
 * **Não altera comportamento** — a edge function pode (futuramente)
 * importar daqui, mas hoje convive com cópias internas para não quebrar
 * o deploy. Qualquer mudança de regra DEVE ser refletida em ambos.
 */

export type Intensity = "leve" | "moderado" | "intenso";
export type RecalcType = "manual" | "missed_goal" | "teacher_update" | "auto";

export interface IntensityProfile {
  tasksPerDay: number;
  daysPerWeek: number;
}

export const INTENSITY: Record<Intensity, IntensityProfile> = {
  leve: { tasksPerDay: 2, daysPerWeek: 4 },
  moderado: { tasksPerDay: 3, daysPerWeek: 5 },
  intenso: { tasksPerDay: 4, daysPerWeek: 6 },
};

export const SOURCE_MAP: Record<RecalcType, string> = {
  manual: "planner",
  auto: "planner_auto",
  missed_goal: "replan_missed_goal",
  teacher_update: "replan_teacher_update",
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/**
 * Constrói lista de datas de estudo entre `start` (inclusive) e `exam` (inclusive),
 * removendo dias de folga conforme `daysPerWeek`:
 *   - 7 dias úteis  → nenhuma folga
 *   - 6 dias úteis  → folga domingo
 *   - 5 dias úteis  → folga sábado + domingo
 *   - 4 dias úteis  → folga sexta + sábado + domingo
 */
export function buildStudyDates(start: Date, exam: Date, daysPerWeek: number): Date[] {
  const dates: Date[] = [];
  const restDays = 7 - daysPerWeek;
  let cursor = new Date(start);
  while (cursor.getTime() <= exam.getTime()) {
    const dow = cursor.getUTCDay();
    const restSet = new Set<number>();
    if (restDays >= 1) restSet.add(0);
    if (restDays >= 2) restSet.add(6);
    if (restDays >= 3) restSet.add(5);
    if (!restSet.has(dow)) dates.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function resolveTaskSource(reason: RecalcType | undefined): string {
  return SOURCE_MAP[reason ?? "manual"] ?? "planner";
}

/** Default reason text used when professor/aluno não especifica `reasonText`. */
export function defaultReasonText(reason: RecalcType): string {
  switch (reason) {
    case "missed_goal":
      return "Plano recalculado por meta semanal não cumprida";
    case "teacher_update":
      return "Plano atualizado pelo professor";
    case "auto":
      return "Recálculo automático do sistema";
    default:
      return "Recálculo manual";
  }
}

/* ─── Inatividade ─── */

export const INACTIVE_THRESHOLD_DAYS = 3;

export function isStudentInactive(
  lastActivityAt: string | Date | null | undefined,
  now: Date = new Date(),
  thresholdDays = INACTIVE_THRESHOLD_DAYS,
): boolean {
  if (!lastActivityAt) return true;
  const ts = lastActivityAt instanceof Date ? lastActivityAt.getTime() : new Date(lastActivityAt).getTime();
  if (Number.isNaN(ts)) return true;
  return ts < now.getTime() - thresholdDays * 86400000;
}

/* ─── Progress aggregation ─── */

export interface RawTaskRow {
  status: "pending" | "completed" | "skipped" | "overdue";
  planned_date: string;
}

export interface ProgressCounts {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  progressPercent: number;
}

export function computeProgressCounts(
  tasks: RawTaskRow[],
  todayIso: string,
): ProgressCounts {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter(
    (t) => t.status === "pending" && t.planned_date < todayIso,
  ).length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pending, overdue, progressPercent };
}

/**
 * Classifica meta semanal baseada na razão de tarefas concluídas na semana.
 *  - done: ≥ 100%
 *  - partial: ≥ 50%
 *  - missed: < 50%
 */
export type WeeklyGoalStatus = "done" | "partial" | "missed";
export function computeWeeklyGoalStatus(
  weekDone: number,
  weekTotal: number,
): WeeklyGoalStatus {
  if (weekTotal <= 0) return "partial";
  const ratio = weekDone / weekTotal;
  if (ratio >= 1) return "done";
  if (ratio >= 0.5) return "partial";
  return "missed";
}
