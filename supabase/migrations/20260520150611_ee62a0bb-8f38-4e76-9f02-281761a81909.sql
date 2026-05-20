-- Remover função antiga para mudar tipo de retorno
DROP FUNCTION IF EXISTS public.mark_pedagogical_event_consumed(uuid,text,boolean,jsonb);

-- Função para marcar evento como consumido com segurança
CREATE OR REPLACE FUNCTION public.mark_pedagogical_event_consumed(
    event_id UUID,
    consumer_name TEXT,
    success BOOLEAN,
    result_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.pedagogical_events
    SET 
        is_consumed = success,
        consumed_at = now(),
        result_metadata = jsonb_build_object(
            'consumer', consumer_name,
            'success', success,
            'data', result_metadata
        )
    WHERE id = event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
