-- 1. Habilitar a extensão net se ainda não estiver (necessária para http requests)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Criar função para disparar o webhook da Edge Function
CREATE OR REPLACE FUNCTION public.notify_pedagogical_event()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    payload := jsonb_build_object('event', row_to_json(NEW));
    
    -- Disparar requisição assíncrona para a Edge Function de consumo
    PERFORM net.http_post(
        url := (SELECT value FROM platform_config WHERE key = 'edge_function_base_url' LIMIT 1) || '/pedagogical-event-consumer',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT value FROM secrets WHERE key = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
        ),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar o Trigger na tabela pedagogical_events
DROP TRIGGER IF EXISTS tr_on_pedagogical_event_created ON public.pedagogical_events;
CREATE TRIGGER tr_on_pedagogical_event_created
AFTER INSERT ON public.pedagogical_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_pedagogical_event();
