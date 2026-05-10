-- Add source_conversation_id to cme_session_aggregations
ALTER TABLE public.cme_session_aggregations 
ADD COLUMN IF NOT EXISTS source_conversation_id UUID REFERENCES public.chat_conversations(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_cme_aggregations_source_conv ON public.cme_session_aggregations(source_conversation_id);

-- Add comment
COMMENT ON COLUMN public.cme_session_aggregations.source_conversation_id IS 'ID da conversa original que gerou esta agregação';
