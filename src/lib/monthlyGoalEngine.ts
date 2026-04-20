import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de Meta Mensal de Questões.
 * Reutiliza practice_attempts (questões resolvidas) + profiles.exam_date (data da prova).
 * NÃO altera FSRS, Planner ou Study Engine internamente — apenas calcula e expõe sinais.
 */

export interface MonthlyGoalStatus {
  /** Meta mensal de questões (default 2000) */
  targetQuestions: number;
  /** Questões resolvidas no mês corrente */
  completedQuestions: number;
  /** Percentual concluído (0–100) */
  percentComplete: number;
  /** Dias restantes no mês ou até a prova (o que vier antes) */
  daysRemaining: number;
  /** Questões/dia necessárias para bater a meta */
  requiredDailyQuestions: number;
  /** Ritmo médio diário atual */
  currentDailyPace: number;
  /** Status do ritmo */
  paceStatus: "behind" | "on_track" | "ahead";
  /** Mês corrente (1–12) */
  month: number;
  /** Ano corrente */
  year: number;
  /** Se há prova marcada antes do fim do mês */
  examWithinMonth: boolean;
}

const DEFAULT_TARGET = 2000;

/** Dias restantes no mês corrente (incluindo hoje) */
function daysLeftInMonth(now: Date): number {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
}

/** Dias decorridos no mês (incluindo hoje) */
function daysElapsedInMonth(now: Date): number {
  return now.getDate();
}

export async function getMonthlyGoalStatus(userId: string): Promise<MonthlyGoalStatus> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1).toISOString();

  // 1. Buscar/garantir meta do mês
  let { data: goal } = await supabase
    .from("study_goal_monthly")
    .select("target_questions, completed_questions")
    .eq("user_id", userId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (!goal) {
    const { data: created } = await supabase
      .from("study_goal_monthly")
      .insert({ user_id: userId, month, year, target_questions: DEFAULT_TARGET, completed_questions: 0 })
      .select("target_questions, completed_questions")
      .single();
    goal = created ?? { target_questions: DEFAULT_TARGET, completed_questions: 0 };
  }

  // 2. Contar questões reais do mês via practice_attempts (fonte de verdade)
  const { count: realCount } = await supabase
    .from("practice_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart);

  const completedQuestions = realCount ?? goal.completed_questions ?? 0;
  const targetQuestions = goal.target_questions ?? DEFAULT_TARGET;

  // 3. Sincroniza completed_questions se divergiu (best-effort, não bloqueia)
  if (completedQuestions !== goal.completed_questions) {
    supabase
      .from("study_goal_monthly")
      .update({ completed_questions: completedQuestions })
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .then(() => {});
  }

  // 4. Verificar se a prova cai antes do fim do mês
  const { data: profile } = await supabase
    .from("profiles")
    .select("exam_date")
    .eq("user_id", userId)
    .maybeSingle();

  const examDate = profile?.exam_date ? new Date(profile.exam_date) : null;
  const monthEnd = new Date(year, month, 0);
  const examWithinMonth = !!(examDate && examDate <= monthEnd && examDate >= now);

  // 5. Dias restantes (até prova ou fim do mês)
  let daysRemaining = daysLeftInMonth(now);
  if (examWithinMonth && examDate) {
    const diffMs = examDate.getTime() - now.getTime();
    daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const remaining = Math.max(0, targetQuestions - completedQuestions);
  const requiredDailyQuestions = Math.ceil(remaining / daysRemaining);

  const elapsed = daysElapsedInMonth(now);
  const currentDailyPace = elapsed > 0 ? Math.round(completedQuestions / elapsed) : 0;

  const expectedSoFar = Math.round((targetQuestions / (elapsed + daysRemaining - 1)) * elapsed);
  let paceStatus: MonthlyGoalStatus["paceStatus"] = "on_track";
  if (completedQuestions < expectedSoFar * 0.85) paceStatus = "behind";
  else if (completedQuestions > expectedSoFar * 1.15) paceStatus = "ahead";

  const percentComplete = Math.min(100, Math.round((completedQuestions / targetQuestions) * 100));

  return {
    targetQuestions,
    completedQuestions,
    percentComplete,
    daysRemaining,
    requiredDailyQuestions,
    currentDailyPace,
    paceStatus,
    month,
    year,
    examWithinMonth,
  };
}

/** Atualiza meta mensal (ex: usuário muda de 2000 para 2500) */
export async function updateMonthlyTarget(userId: string, target: number): Promise<void> {
  const now = new Date();
  await supabase
    .from("study_goal_monthly")
    .upsert(
      {
        user_id: userId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        target_questions: Math.max(100, target),
      },
      { onConflict: "user_id,year,month" }
    );
}
