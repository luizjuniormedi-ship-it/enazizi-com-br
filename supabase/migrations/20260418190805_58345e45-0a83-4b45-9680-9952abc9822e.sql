-- 1) questions_bank: padrão dominante é (is_global=true AND review_status='approved') + filtro por topic ILIKE
-- Índice parcial cobre o caminho mais quente (cache global aprovado) sem inflar storage
CREATE INDEX IF NOT EXISTS idx_qb_global_approved_topic
  ON public.questions_bank (topic, difficulty)
  WHERE is_global = true AND review_status = 'approved';

-- Índice composto para queries do usuário ("minhas + globais")
CREATE INDEX IF NOT EXISTS idx_qb_user_global_status
  ON public.questions_bank (user_id, is_global, review_status);

-- 2) flashcards: padrão (user_id, is_global) — não existe deck_id no schema atual
CREATE INDEX IF NOT EXISTS idx_flashcards_user_global
  ON public.flashcards (user_id, is_global, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcards_global_created
  ON public.flashcards (created_at DESC)
  WHERE is_global = true;

-- 3) practice_attempts: já existe idx_practice_attempts_user_created — apenas garantimos
-- (idempotente, sem duplicar)

-- 4) admin_messages: notificações por destinatário ordenadas por data
CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_created
  ON public.admin_messages (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_messages_broadcast_created
  ON public.admin_messages (created_at DESC)
  WHERE recipient_id IS NULL;

-- 5) Atualiza estatísticas para o planner usar os novos índices imediatamente
ANALYZE public.questions_bank;
ANALYZE public.flashcards;
ANALYZE public.practice_attempts;
ANALYZE public.admin_messages;