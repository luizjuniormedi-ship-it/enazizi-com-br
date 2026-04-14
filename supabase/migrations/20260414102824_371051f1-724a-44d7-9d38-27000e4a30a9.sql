
-- Add image_url and score_linguistico to mnemonic_results
ALTER TABLE public.mnemonic_results
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS score_linguistico numeric(5,2);

-- Update agent_name validation to accept new agents
CREATE OR REPLACE FUNCTION public.validate_mnemonic_agent_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.agent_name not in (
    'gerador', 'auditor_medico', 'auditor_pedagogico', 'visual', 'consolidador',
    'retry_gerador', 'retry_auditor_medico', 'retry_auditor_pedagogico',
    'auditor_linguistico_ptbr', 'retry_linguistico', 'gerador_imagem'
  ) then
    raise exception 'Invalid mnemonic_agent_logs.agent_name: %', new.agent_name;
  end if;
  if new.status not in ('pending', 'completed', 'failed') then
    raise exception 'Invalid mnemonic_agent_logs.status: %', new.status;
  end if;
  return new;
end;
$function$;
