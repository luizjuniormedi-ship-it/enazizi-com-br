CREATE INDEX IF NOT EXISTS idx_revisoes_user_status_data ON public.revisoes (user_id, status, data_revisao);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_created ON public.practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_bank_user_dominado ON public.error_bank (user_id, dominado);
CREATE INDEX IF NOT EXISTS idx_daily_plan_tasks_user_completed ON public.daily_plan_tasks (user_id, completed);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_status ON public.exam_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_fsrs_cards_user_due ON public.fsrs_cards (user_id, due);
CREATE INDEX IF NOT EXISTS idx_temas_estudados_user_tema ON public.temas_estudados (user_id, tema);