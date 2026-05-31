UPDATE public.enrichment_control
SET is_paused = false, pause_reason = null, processed_today = 0, updated_at = now()
WHERE id = 1;
