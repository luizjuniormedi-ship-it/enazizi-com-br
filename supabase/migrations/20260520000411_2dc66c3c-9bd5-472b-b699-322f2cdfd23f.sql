-- Criar tabela de configuração ALOS
CREATE TABLE IF NOT EXISTS public.alos_system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO public.alos_system_config (config_key, config_value)
VALUES ('edge_function_base_url', 'https://qszsyskumcmuknumwxtk.supabase.co/functions/v1')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Atualizar o trigger para usar a nova tabela
CREATE OR REPLACE FUNCTION public.notify_pedagogical_event()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
    target_url TEXT;
BEGIN
    SELECT config_value INTO target_url FROM public.alos_system_config WHERE config_key = 'edge_function_base_url' LIMIT 1;
    
    payload := jsonb_build_object('event', row_to_json(NEW));
    
    PERFORM net.http_post(
        url := target_url || '/pedagogical-event-consumer',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
