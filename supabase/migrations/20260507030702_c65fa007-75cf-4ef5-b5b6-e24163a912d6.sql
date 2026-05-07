-- Adicionar colunas de idempotência e trace ID
ALTER TABLE public.teacher_simulados 
ADD COLUMN IF NOT EXISTS client_request_id UUID,
ADD COLUMN IF NOT EXISTS trace_id UUID;

ALTER TABLE public.teacher_simulado_assignments
ADD COLUMN IF NOT EXISTS trace_id UUID;

-- Criar índice único para evitar duplicatas por request ID
-- Somente se o client_request_id não for nulo
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_simulados_idempotency 
ON public.teacher_simulados (professor_id, client_request_id) 
WHERE client_request_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.teacher_simulados.client_request_id IS 'ID gerado pelo cliente para garantir que o mesmo pedido não crie registros duplicados.';
COMMENT ON COLUMN public.teacher_simulados.trace_id IS 'ID de rastreamento para correlacionar logs do frontend com o backend.';
