/**
 * CSV export helpers para o Relatório do Plano de Proficiência.
 *
 * Extraído de `PlanAnalyticsDialog.tsx` para permitir testes unitários
 * sem depender de DOM/Blob. A função do componente continua a mesma —
 * apenas delega para `buildPlanCsv()` aqui.
 */
import type { PlanAnalyticsStudentRow } from "@/hooks/useProficiencyAnalytics";

export const CSV_HEADERS = [
  "plano",
  "aluno",
  "email",
  "origem",
  "turma",
  "progresso_percent",
  "weekly_goal_status",
  "completed_tasks",
  "pending_tasks",
  "overdue_tasks",
  "recalc_count",
  "inativo",
  "last_activity_at",
] as const;

export function escapeCsvField(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildPlanCsvRow(
  planName: string,
  s: PlanAnalyticsStudentRow,
): string {
  return [
    planName,
    s.display_name ?? "",
    s.email ?? "",
    s.source === "direct" ? "Direto" : "Turma",
    s.class_label ?? "",
    Math.round(s.progress_percent),
    s.weekly_goal_status ?? "",
    s.completed_tasks,
    s.pending_tasks,
    s.overdue_tasks,
    s.recalc_count,
    s.is_inactive ? "sim" : "nao",
    s.last_activity_at ?? "",
  ]
    .map(escapeCsvField)
    .join(",");
}

export function buildPlanCsv(
  planName: string,
  students: PlanAnalyticsStudentRow[],
): string {
  const header = CSV_HEADERS.join(",");
  const rows = students.map((s) => buildPlanCsvRow(planName, s));
  return [header, ...rows].join("\n");
}

/** UTF-8 BOM prefix mantido idêntico ao componente original. */
export const CSV_BOM = "\uFEFF";

export function buildPlanCsvWithBom(
  planName: string,
  students: PlanAnalyticsStudentRow[],
): string {
  return CSV_BOM + buildPlanCsv(planName, students);
}
