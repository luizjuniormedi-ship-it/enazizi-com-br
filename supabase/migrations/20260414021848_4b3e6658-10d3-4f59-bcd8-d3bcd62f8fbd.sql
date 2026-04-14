
-- Fix views: use SECURITY INVOKER
drop view if exists public.v_mnemonic_latest_results;
create view public.v_mnemonic_latest_results
with (security_invoker = true) as
select
  r.id, r.request_id, r.user_id, r.tema, r.sigla, r.frase_mnemonica,
  r.score_medico, r.score_pedagogico, r.score_final, r.aprovado, r.created_at
from public.mnemonic_results r
where r.is_latest = true;

drop view if exists public.v_mnemonic_user_stats;
create view public.v_mnemonic_user_stats
with (security_invoker = true) as
select
  user_id,
  count(*) as total_resultados,
  count(*) filter (where aprovado = true) as total_aprovados,
  round(avg(score_medico), 2) as media_score_medico,
  round(avg(score_pedagogico), 2) as media_score_pedagogico,
  round(avg(score_final), 2) as media_score_final,
  max(created_at) as ultimo_resultado_em
from public.mnemonic_results
group by user_id;

-- Fix function search_path
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.mnemonic_results_single_latest()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_latest = true then
    update public.mnemonic_results
       set is_latest = false, updated_at = now()
     where request_id = new.request_id and id <> new.id;
  end if;
  return new;
end;
$$;

create or replace function public.validate_mnemonic_request_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status not in ('pending', 'processing', 'completed', 'failed') then
    raise exception 'Invalid mnemonic_requests.status: %', new.status;
  end if;
  return new;
end;
$$;

create or replace function public.validate_mnemonic_agent_log()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.agent_name not in (
    'gerador', 'auditor_medico', 'auditor_pedagogico', 'visual', 'consolidador',
    'retry_gerador', 'retry_auditor_medico', 'retry_auditor_pedagogico'
  ) then
    raise exception 'Invalid mnemonic_agent_logs.agent_name: %', new.agent_name;
  end if;
  if new.status not in ('pending', 'completed', 'failed') then
    raise exception 'Invalid mnemonic_agent_logs.status: %', new.status;
  end if;
  return new;
end;
$$;

create or replace function public.validate_mnemonic_feedback_ratings()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.rating_general is not null and (new.rating_general < 1 or new.rating_general > 5) then
    raise exception 'rating_general must be between 1 and 5';
  end if;
  if new.rating_medical is not null and (new.rating_medical < 1 or new.rating_medical > 5) then
    raise exception 'rating_medical must be between 1 and 5';
  end if;
  if new.rating_pedagogical is not null and (new.rating_pedagogical < 1 or new.rating_pedagogical > 5) then
    raise exception 'rating_pedagogical must be between 1 and 5';
  end if;
  return new;
end;
$$;
