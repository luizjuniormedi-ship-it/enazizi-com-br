
-- =====================================================================
-- HARDENING OPERACIONAL — Sprint 2.3 (defensivo, sem destruição)
-- =====================================================================

-- AÇÃO 2: Marcar TRI como experimental
ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS psychometric_status TEXT NOT NULL DEFAULT 'experimental';

ALTER TABLE public.real_exam_questions
  ADD COLUMN IF NOT EXISTS psychometric_status TEXT NOT NULL DEFAULT 'experimental';

COMMENT ON COLUMN public.questions_bank.psychometric_status IS
  'Sprint 2.3 guard-rail: experimental|validated|calibrated. Default experimental — TRI/difficulty atual deriva de heurística IA, não de resposta real. Promoção exige ≥100 respostas reais.';

COMMENT ON COLUMN public.questions_bank.tri_difficulty_score IS
  'EXPERIMENTAL — bootstrap heurístico de ingestão. NÃO usar em Prova Real oficial até psychometric_status=calibrated.';
COMMENT ON COLUMN public.questions_bank.tri_discrimination IS
  'EXPERIMENTAL — heurística. Exige ≥50 respostas reais para validação. NÃO usar em ranking/aprovação.';
COMMENT ON COLUMN public.questions_bank.tri_guessing IS
  'EXPERIMENTAL — bootstrap. NÃO usar em adaptive high-stakes.';
COMMENT ON COLUMN public.questions_bank.latent_ability_theta IS
  'EXPERIMENTAL — não populado. Aguardar massa estatística real (≥100 respostas).';
COMMENT ON COLUMN public.questions_bank.difficulty IS
  'EXPERIMENTAL — derivado de heurística IA na ingestão. Recalibração exige ≥100 respostas reais.';

COMMENT ON COLUMN public.real_exam_questions.psychometric_status IS
  'Sprint 2.3 guard-rail: experimental por padrão. Promoção exige massa estatística real.';
COMMENT ON COLUMN public.real_exam_questions.difficulty IS
  'EXPERIMENTAL — heurístico de ingestão. NÃO calibrar sem massa real.';
COMMENT ON COLUMN public.real_exam_questions.quality_score IS
  'EXPERIMENTAL — score de ingestão, não validado por auditoria pedagógica.';

-- AÇÃO 3: Marcar tabelas órfãs como DEPRECATED (comment-only, NUNCA dropar)
COMMENT ON TABLE public.simulado_answers IS
  'DEPRECATED — not connected to active production flow (Sprint 2.3). Telemetria de respostas vai para simulado_question_analytics e practice_attempts. NÃO escrever novos dados aqui. NÃO dropar — preservar histórico.';

COMMENT ON TABLE public.question_usage_logs IS
  'DEPRECATED — not connected to active production flow (Sprint 2.3). Sem writers em produção. NÃO escrever novos dados. NÃO dropar — preservar histórico.';

COMMENT ON TABLE public.theta_history IS
  'DEPRECATED — not connected to active production flow (Sprint 2.3). Sem cálculo theta real (latent_ability_theta=0). NÃO escrever novos dados. NÃO dropar.';

COMMENT ON TABLE public.medical_image_attempts IS
  'DEPRECATED — not connected to active production flow (Sprint 2.3). Sem writers ativos. NÃO escrever novos dados. NÃO dropar.';

-- AÇÃO 1: Exclusão defensiva de usuários-bot dos analytics
CREATE TABLE IF NOT EXISTS public.analytics_excluded_users (
  user_id UUID PRIMARY KEY,
  reason TEXT NOT NULL,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

GRANT SELECT ON public.analytics_excluded_users TO authenticated;
GRANT ALL ON public.analytics_excluded_users TO service_role;

ALTER TABLE public.analytics_excluded_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read analytics exclusions"
  ON public.analytics_excluded_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.analytics_excluded_users IS
  'Sprint 2.3 — usuários excluídos de dashboards/analytics oficiais (bots, contas de teste, geradores de ruído). Filtro defensivo, NÃO deleta dados originais.';

INSERT INTO public.analytics_excluded_users (user_id, reason, notes)
VALUES (
  'a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023',
  'bot_test_traffic',
  'Sprint 2.3 read-only diagnostic: 3.280 sessões criadas, 0 finalizações, contamina abandono/engajamento/completion/retention. Histórico preservado, excluído apenas de métricas oficiais.'
)
ON CONFLICT (user_id) DO NOTHING;

-- Helper: função para filtros downstream (RLS-safe, leitura pública do filtro)
CREATE OR REPLACE FUNCTION public.is_analytics_excluded(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.analytics_excluded_users WHERE user_id = _user_id);
$$;

COMMENT ON FUNCTION public.is_analytics_excluded(UUID) IS
  'Sprint 2.3 — retorna true se o usuário deve ser excluído de dashboards/métricas oficiais.';
