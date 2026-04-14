
-- =========================================================
-- TABELA: mnemonic_requests
-- =========================================================
create table if not exists public.mnemonic_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tema text not null,
  termos_json jsonb not null default '[]'::jsonb,
  estilo text,
  publico text,
  idioma text default 'pt-BR',
  status text not null default 'pending',
  source text default 'lovable-ui',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mnemonic_requests_user_id
  on public.mnemonic_requests(user_id);
create index if not exists idx_mnemonic_requests_status
  on public.mnemonic_requests(status);
create index if not exists idx_mnemonic_requests_created_at
  on public.mnemonic_requests(created_at desc);
create index if not exists idx_mnemonic_requests_tema
  on public.mnemonic_requests using gin (to_tsvector('portuguese', coalesce(tema, '')));
create index if not exists idx_mnemonic_requests_termos_json
  on public.mnemonic_requests using gin (termos_json);

-- =========================================================
-- TABELA: mnemonic_results
-- =========================================================
create table if not exists public.mnemonic_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mnemonic_requests(id) on delete cascade,
  user_id uuid not null,
  tema text not null,
  sigla text not null,
  frase_mnemonica text not null,
  explicacao_tecnica text,
  explicacao_didatica text,
  cena_visual text,
  prompt_imagem text,
  associacoes_json jsonb not null default '[]'::jsonb,
  associacoes_visuais_json jsonb not null default '[]'::jsonb,
  alertas_json jsonb not null default '[]'::jsonb,
  score_medico numeric(5,2) not null default 0,
  score_pedagogico numeric(5,2) not null default 0,
  score_final numeric(5,2) not null default 0,
  aprovado boolean not null default false,
  aprovado_medico boolean not null default false,
  aprovado_pedagogico boolean not null default false,
  versao integer not null default 1,
  is_latest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mnemonic_results_request_id
  on public.mnemonic_results(request_id);
create index if not exists idx_mnemonic_results_user_id
  on public.mnemonic_results(user_id);
create index if not exists idx_mnemonic_results_aprovado
  on public.mnemonic_results(aprovado);
create index if not exists idx_mnemonic_results_latest
  on public.mnemonic_results(is_latest);
create index if not exists idx_mnemonic_results_created_at
  on public.mnemonic_results(created_at desc);
create index if not exists idx_mnemonic_results_sigla
  on public.mnemonic_results(sigla);
create index if not exists idx_mnemonic_results_frase
  on public.mnemonic_results using gin (to_tsvector('portuguese', coalesce(frase_mnemonica, '')));
create index if not exists idx_mnemonic_results_alertas_json
  on public.mnemonic_results using gin (alertas_json);

-- =========================================================
-- TABELA: mnemonic_agent_logs
-- =========================================================
create table if not exists public.mnemonic_agent_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.mnemonic_requests(id) on delete cascade,
  result_id uuid references public.mnemonic_results(id) on delete cascade,
  user_id uuid not null,
  agent_name text not null,
  execution_order integer not null default 1,
  status text not null default 'completed',
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mnemonic_agent_logs_request_id
  on public.mnemonic_agent_logs(request_id);
create index if not exists idx_mnemonic_agent_logs_result_id
  on public.mnemonic_agent_logs(result_id);
create index if not exists idx_mnemonic_agent_logs_user_id
  on public.mnemonic_agent_logs(user_id);
create index if not exists idx_mnemonic_agent_logs_agent_name
  on public.mnemonic_agent_logs(agent_name);
create index if not exists idx_mnemonic_agent_logs_created_at
  on public.mnemonic_agent_logs(created_at desc);
create index if not exists idx_mnemonic_agent_logs_input_json
  on public.mnemonic_agent_logs using gin (input_json);
create index if not exists idx_mnemonic_agent_logs_output_json
  on public.mnemonic_agent_logs using gin (output_json);

-- =========================================================
-- Validation triggers (instead of CHECK constraints)
-- =========================================================
create or replace function public.validate_mnemonic_request_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status not in ('pending', 'processing', 'completed', 'failed') then
    raise exception 'Invalid mnemonic_requests.status: %', new.status;
  end if;
  return new;
end;
$$;

create trigger trg_validate_mnemonic_request_status
before insert or update on public.mnemonic_requests
for each row execute function public.validate_mnemonic_request_status();

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

create trigger trg_validate_mnemonic_agent_log
before insert or update on public.mnemonic_agent_logs
for each row execute function public.validate_mnemonic_agent_log();

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

-- =========================================================
-- TABELA: mnemonic_favorites
-- =========================================================
create table if not exists public.mnemonic_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  result_id uuid not null references public.mnemonic_results(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, result_id)
);

create index if not exists idx_mnemonic_favorites_user_id
  on public.mnemonic_favorites(user_id);
create index if not exists idx_mnemonic_favorites_result_id
  on public.mnemonic_favorites(result_id);

-- =========================================================
-- TABELA: mnemonic_feedback
-- =========================================================
create table if not exists public.mnemonic_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid references public.mnemonic_requests(id) on delete cascade,
  result_id uuid references public.mnemonic_results(id) on delete cascade,
  rating_general integer,
  rating_medical integer,
  rating_pedagogical integer,
  comentario text,
  created_at timestamptz not null default now()
);

create trigger trg_validate_mnemonic_feedback_ratings
before insert or update on public.mnemonic_feedback
for each row execute function public.validate_mnemonic_feedback_ratings();

create index if not exists idx_mnemonic_feedback_user_id
  on public.mnemonic_feedback(user_id);
create index if not exists idx_mnemonic_feedback_result_id
  on public.mnemonic_feedback(result_id);

-- =========================================================
-- FUNÇÃO: updated_at automático
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_mnemonic_requests_updated_at
before update on public.mnemonic_requests
for each row execute function public.set_updated_at();

create trigger trg_mnemonic_results_updated_at
before update on public.mnemonic_results
for each row execute function public.set_updated_at();

-- =========================================================
-- FUNÇÃO: manter apenas uma versão latest por request
-- =========================================================
create or replace function public.mnemonic_results_single_latest()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_latest = true then
    update public.mnemonic_results
       set is_latest = false,
           updated_at = now()
     where request_id = new.request_id
       and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger trg_mnemonic_results_single_latest
after insert or update on public.mnemonic_results
for each row execute function public.mnemonic_results_single_latest();

-- =========================================================
-- RLS
-- =========================================================
alter table public.mnemonic_requests enable row level security;
alter table public.mnemonic_results enable row level security;
alter table public.mnemonic_agent_logs enable row level security;
alter table public.mnemonic_favorites enable row level security;
alter table public.mnemonic_feedback enable row level security;

-- mnemonic_requests
create policy "mnemonic_requests_select_own" on public.mnemonic_requests for select to authenticated using (auth.uid() = user_id);
create policy "mnemonic_requests_insert_own" on public.mnemonic_requests for insert to authenticated with check (auth.uid() = user_id);
create policy "mnemonic_requests_update_own" on public.mnemonic_requests for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mnemonic_requests_delete_own" on public.mnemonic_requests for delete to authenticated using (auth.uid() = user_id);

-- mnemonic_results
create policy "mnemonic_results_select_own" on public.mnemonic_results for select to authenticated using (auth.uid() = user_id);
create policy "mnemonic_results_insert_own" on public.mnemonic_results for insert to authenticated with check (auth.uid() = user_id);
create policy "mnemonic_results_update_own" on public.mnemonic_results for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mnemonic_results_delete_own" on public.mnemonic_results for delete to authenticated using (auth.uid() = user_id);

-- mnemonic_agent_logs
create policy "mnemonic_agent_logs_select_own" on public.mnemonic_agent_logs for select to authenticated using (auth.uid() = user_id);
create policy "mnemonic_agent_logs_insert_own" on public.mnemonic_agent_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "mnemonic_agent_logs_update_own" on public.mnemonic_agent_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mnemonic_agent_logs_delete_own" on public.mnemonic_agent_logs for delete to authenticated using (auth.uid() = user_id);

-- mnemonic_favorites
create policy "mnemonic_favorites_select_own" on public.mnemonic_favorites for select to authenticated using (auth.uid() = user_id);
create policy "mnemonic_favorites_insert_own" on public.mnemonic_favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "mnemonic_favorites_delete_own" on public.mnemonic_favorites for delete to authenticated using (auth.uid() = user_id);

-- mnemonic_feedback
create policy "mnemonic_feedback_select_own" on public.mnemonic_feedback for select to authenticated using (auth.uid() = user_id);
create policy "mnemonic_feedback_insert_own" on public.mnemonic_feedback for insert to authenticated with check (auth.uid() = user_id);
create policy "mnemonic_feedback_update_own" on public.mnemonic_feedback for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mnemonic_feedback_delete_own" on public.mnemonic_feedback for delete to authenticated using (auth.uid() = user_id);

-- =========================================================
-- VIEWS
-- =========================================================
create or replace view public.v_mnemonic_latest_results as
select
  r.id, r.request_id, r.user_id, r.tema, r.sigla, r.frase_mnemonica,
  r.score_medico, r.score_pedagogico, r.score_final, r.aprovado, r.created_at
from public.mnemonic_results r
where r.is_latest = true;

create or replace view public.v_mnemonic_user_stats as
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
