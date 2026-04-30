-- Adicionar comentário de auditoria ao banco
COMMENT ON DATABASE postgres IS 'ENAZIZI - Plataforma Educacional Médica. Escopo: Residência, Internato e Provas. Isolado de ProntoMedic.';

-- Garantir que a coluna de exportação NotebookLM exista e esteja limpa para o auditor
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_content_library' AND column_name = 'notebooklm_export_text') THEN
        ALTER TABLE public.master_content_library ADD COLUMN notebooklm_export_text text;
    END IF;
END $$;

-- Auditoria de Prompts: Garantir que não existam referências a ProntoMedic nos prompts ativos
-- Nota: Isso é um check de segurança de dados
DO $$
DECLARE
    prompt_record RECORD;
BEGIN
    FOR prompt_record IN SELECT id, system_prompt FROM public.medical_ai_prompts WHERE is_active = true LOOP
        IF prompt_record.system_prompt ILIKE '%ProntoMedic%' THEN
            UPDATE public.medical_ai_prompts 
            SET system_prompt = REPLACE(REPLACE(system_prompt, 'ProntoMedic', 'ENAZIZI'), 'hospitalar', 'educacional')
            WHERE id = prompt_record.id;
        END IF;
    END LOOP;
END $$;
