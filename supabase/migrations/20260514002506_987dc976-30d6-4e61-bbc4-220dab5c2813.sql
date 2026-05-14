CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_date ON practice_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fsrs_cards_user_due ON fsrs_cards (user_id, due);
CREATE INDEX IF NOT EXISTS idx_revisoes_user_status_date ON revisoes (user_id, status, data_revisao);