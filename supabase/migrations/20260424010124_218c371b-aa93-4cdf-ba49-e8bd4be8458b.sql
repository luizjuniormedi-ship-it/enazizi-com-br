-- 1. Habilitar pgvector
create extension if not exists vector;

-- 2. Adicionar coluna embedding (text-embedding-3-small = 1536 dims)
alter table public.tutor_knowledge_memory
  add column if not exists embedding vector(1536);

-- 3. Índice IVFFlat para busca por cosseno
create index if not exists idx_tutor_memory_embedding
  on public.tutor_knowledge_memory
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. RPC de busca semântica
create or replace function public.match_tutor_memory(
  query_embedding vector(1536),
  match_threshold float default 0.82,
  match_count int default 5,
  user_id_filter uuid default null
)
returns table (
  id uuid,
  scope text,
  user_id uuid,
  question_original text,
  question_normalized text,
  topic text,
  subtopic text,
  specialty text,
  intent text,
  difficulty_level text,
  answer_summary text,
  blocks jsonb,
  block_types text[],
  quality_score numeric,
  reuse_count int,
  source text,
  model_used text,
  created_at timestamptz,
  updated_at timestamptz,
  last_used_at timestamptz,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.scope,
    m.user_id,
    m.question_original,
    m.question_normalized,
    m.topic,
    m.subtopic,
    m.specialty,
    m.intent,
    m.difficulty_level,
    m.answer_summary,
    m.blocks,
    m.block_types,
    m.quality_score,
    m.reuse_count,
    m.source,
    m.model_used,
    m.created_at,
    m.updated_at,
    m.last_used_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from public.tutor_knowledge_memory m
  where m.embedding is not null
    and m.embedding_status = 'ready'
    and m.quality_score >= 50
    and (
      m.scope = 'global'
      or (m.scope = 'user' and m.user_id = coalesce(user_id_filter, auth.uid()))
    )
    and (1 - (m.embedding <=> query_embedding)) >= match_threshold
  order by m.embedding <=> query_embedding asc
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_tutor_memory(vector, float, int, uuid) to authenticated, anon;