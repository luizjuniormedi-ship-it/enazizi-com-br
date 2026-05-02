CREATE INDEX IF NOT EXISTS idx_cme_worker_nodes_status ON public.cme_worker_nodes(status);
CREATE INDEX IF NOT EXISTS idx_cme_worker_nodes_heartbeat ON public.cme_worker_nodes(last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_cme_worker_nodes_draining ON public.cme_worker_nodes(is_draining);