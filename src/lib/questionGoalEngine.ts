/**
 * questionGoalEngine — Janela rolante 30 dias
 * ────────────────────────────────────────────
 * Diferente do `monthlyGoalEngine` (mês-calendário, dirige UI),
 * este motor calcula um backlog de questões em **janela rolante de 30 dias**
 * para alimentar boosts de prioridade no Study Engine.
 *
 * Fonte de verdade: `practice_attempts`.
 * NÃO altera schema, NÃO escreve em tabela alguma.
 */
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_TARGET_30D = 2000;

export interface QuestionGoalStatus {
  questions_30d: number;
  target: number;
  backlog: number;
  days_left: number;
  daily_target: number;
  status: "ok" | "behind";
}

/**
 * @param userId  ID do usuário
 * @param examDate Data da prova (string ISO ou Date) — opcional; se presente,
 *                 reduz `days_left` quando a prova é antes do fim do mês.
 */
export async function getQuestionGoalStatus(
  userId: string,
  examDate?: string | Date | null
): Promise<QuestionGoalStatus> {
  const target = DEFAULT_TARGET_30D;

  // 1) Janela rolante de 30 dias
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count } = await supabase
    .from("practice_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  const questions_30d = count ?? 0;
  const backlog = Math.max(0, target - questions_30d);

  // 2) days_left = min(diasAtéFimDoMês, diasAtéProva), mínimo 1
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysToEndOfMonth = Math.max(
    1,
    Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000)
  );

  let daysToExam: number | null = null;
  if (examDate) {
    const d = examDate instanceof Date ? examDate : new Date(examDate);
    if (!isNaN(d.getTime())) {
      daysToExam = Math.max(1, Math.ceil((d.getTime() - now.getTime()) / 86400000));
    }
  }

  const days_left = daysToExam !== null
    ? Math.max(1, Math.min(daysToEndOfMonth, daysToExam))
    : daysToEndOfMonth;

  const daily_target = backlog > 0 ? Math.ceil(backlog / days_left) : 0;
  const status: "ok" | "behind" = backlog > 0 ? "behind" : "ok";

  return { questions_30d, target, backlog, days_left, daily_target, status };
}
