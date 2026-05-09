-- =====================================================================
-- Loop 4B-idempotência
-- =====================================================================

-- ─── 1. error_bank ────────────────────────────────────────────────────
ALTER TABLE public.error_bank
  ADD COLUMN IF NOT EXISTS tema_norm text
    GENERATED ALWAYS AS (lower(btrim(tema))) STORED,
  ADD COLUMN IF NOT EXISTS subtema_norm text
    GENERATED ALWAYS AS (coalesce(lower(btrim(subtema)), '')) STORED;

-- Dedup: para cada (user_id, tema_norm, subtema_norm, dominado),
-- manter o id mais antigo, somar vezes_errado, levar updated_at/dominado_em
-- mais recente, e preferir não-nulos para conteudo/motivo/categoria.
WITH ranked AS (
  SELECT
    id,
    user_id,
    tema_norm,
    subtema_norm,
    coalesce(dominado, false) AS dominado_norm,
    vezes_errado,
    updated_at,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, tema_norm, subtema_norm, coalesce(dominado, false)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.error_bank
),
groups AS (
  SELECT
    user_id,
    tema_norm,
    subtema_norm,
    coalesce(dominado, false) AS dominado_norm,
    SUM(coalesce(vezes_errado, 1))::int AS total_vezes,
    MAX(updated_at) AS max_updated,
    MAX(dominado_em) AS max_dominado_em
  FROM public.error_bank
  GROUP BY user_id, tema_norm, subtema_norm, coalesce(dominado, false)
  HAVING COUNT(*) > 1
),
canon AS (
  SELECT id, user_id, tema_norm, subtema_norm, dominado_norm
  FROM ranked WHERE rn = 1
),
canon_with_groups AS (
  SELECT c.id, g.total_vezes, g.max_updated, g.max_dominado_em
  FROM canon c
  JOIN groups g
    ON g.user_id = c.user_id
   AND g.tema_norm = c.tema_norm
   AND g.subtema_norm = c.subtema_norm
   AND g.dominado_norm = c.dominado_norm
)
UPDATE public.error_bank eb
SET vezes_errado = cwg.total_vezes,
    updated_at   = cwg.max_updated,
    dominado_em  = COALESCE(eb.dominado_em, cwg.max_dominado_em)
FROM canon_with_groups cwg
WHERE eb.id = cwg.id;

-- Apaga as duplicatas (não-canônicas)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, tema_norm, subtema_norm, coalesce(dominado, false)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.error_bank
)
DELETE FROM public.error_bank
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Unique (permite coexistir uma linha "ativa" e uma "dominada" do mesmo tema)
CREATE UNIQUE INDEX IF NOT EXISTS uq_error_bank_user_tema_dom
  ON public.error_bank (user_id, tema_norm, subtema_norm, (coalesce(dominado, false)));

-- RPC idempotente
CREATE OR REPLACE FUNCTION public.upsert_error_bank_entry(
  p_user_id uuid,
  p_tema text,
  p_subtema text DEFAULT NULL,
  p_tipo_questao text DEFAULT 'objetiva',
  p_conteudo text DEFAULT NULL,
  p_motivo_erro text DEFAULT NULL,
  p_categoria_erro text DEFAULT 'conceitual',
  p_dificuldade int DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_tema IS NULL OR btrim(p_tema) = '' THEN
    RAISE EXCEPTION 'user_id and tema are required';
  END IF;

  INSERT INTO public.error_bank (
    user_id, tema, subtema, tipo_questao, conteudo,
    motivo_erro, categoria_erro, dificuldade, vezes_errado, dominado
  )
  VALUES (
    p_user_id, p_tema, p_subtema, coalesce(p_tipo_questao,'objetiva'), p_conteudo,
    p_motivo_erro, coalesce(p_categoria_erro,'conceitual'), coalesce(p_dificuldade,3), 1, false
  )
  ON CONFLICT (user_id, tema_norm, subtema_norm, (coalesce(dominado, false)))
  DO UPDATE SET
    vezes_errado   = public.error_bank.vezes_errado + 1,
    updated_at     = now(),
    conteudo       = COALESCE(EXCLUDED.conteudo, public.error_bank.conteudo),
    motivo_erro    = COALESCE(EXCLUDED.motivo_erro, public.error_bank.motivo_erro),
    categoria_erro = COALESCE(EXCLUDED.categoria_erro, public.error_bank.categoria_erro),
    dificuldade    = GREATEST(public.error_bank.dificuldade, EXCLUDED.dificuldade)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_error_bank_entry(uuid, text, text, text, text, text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_error_bank_entry(uuid, text, text, text, text, text, text, int)
  TO authenticated, service_role;

-- ─── 2. assistant_decisions ───────────────────────────────────────────
ALTER TABLE public.assistant_decisions
  ADD COLUMN IF NOT EXISTS event_hash text;

CREATE OR REPLACE FUNCTION public.compute_assistant_decision_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_topic text;
  v_minute_bucket bigint;
BEGIN
  IF NEW.event_hash IS NOT NULL AND NEW.event_hash <> '' THEN
    RETURN NEW;
  END IF;
  v_topic := COALESCE(
    NEW.input_snapshot->>'topic',
    NEW.input_snapshot->>'topicId',
    NEW.input_snapshot->>'themeId',
    NEW.input_snapshot->>'taskId',
    NEW.input_snapshot->>'actionId',
    ''
  );
  v_minute_bucket := floor(extract(epoch from COALESCE(NEW.created_at, now())) / 60)::bigint;
  NEW.event_hash := md5(
    NEW.user_id::text
    || ':' || COALESCE(NEW.decision_type, '')
    || ':' || COALESCE(NEW.source_module, '')
    || ':' || v_topic
    || ':' || v_minute_bucket::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assistant_decisions_hash ON public.assistant_decisions;
CREATE TRIGGER trg_assistant_decisions_hash
  BEFORE INSERT ON public.assistant_decisions
  FOR EACH ROW EXECUTE FUNCTION public.compute_assistant_decision_hash();

-- Backfill
UPDATE public.assistant_decisions ad
SET event_hash = md5(
  ad.user_id::text
  || ':' || COALESCE(ad.decision_type, '')
  || ':' || COALESCE(ad.source_module, '')
  || ':' || COALESCE(
       ad.input_snapshot->>'topic',
       ad.input_snapshot->>'topicId',
       ad.input_snapshot->>'themeId',
       ad.input_snapshot->>'taskId',
       ad.input_snapshot->>'actionId',
       ''
     )
  || ':' || floor(extract(epoch from ad.created_at) / 60)::bigint::text
)
WHERE event_hash IS NULL;

-- Dedup: keep earliest per (user_id, event_hash)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, event_hash
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.assistant_decisions
  WHERE event_hash IS NOT NULL
)
DELETE FROM public.assistant_decisions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_decisions_user_hash
  ON public.assistant_decisions (user_id, event_hash)
  WHERE event_hash IS NOT NULL;

-- ─── 3. practice_attempts ─────────────────────────────────────────────
ALTER TABLE public.practice_attempts
  ADD COLUMN IF NOT EXISTS event_hash text;

CREATE OR REPLACE FUNCTION public.compute_practice_attempt_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_minute_bucket bigint;
BEGIN
  IF NEW.event_hash IS NOT NULL AND NEW.event_hash <> '' THEN
    RETURN NEW;
  END IF;
  v_minute_bucket := floor(extract(epoch from COALESCE(NEW.created_at, now())) / 60)::bigint;
  NEW.event_hash := md5(
    NEW.user_id::text
    || ':' || NEW.question_id::text
    || ':' || v_minute_bucket::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practice_attempts_hash ON public.practice_attempts;
CREATE TRIGGER trg_practice_attempts_hash
  BEFORE INSERT ON public.practice_attempts
  FOR EACH ROW EXECUTE FUNCTION public.compute_practice_attempt_hash();

-- Backfill
UPDATE public.practice_attempts pa
SET event_hash = md5(
  pa.user_id::text
  || ':' || pa.question_id::text
  || ':' || floor(extract(epoch from pa.created_at) / 60)::bigint::text
)
WHERE event_hash IS NULL;

-- Dedup keeping earliest
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, event_hash
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.practice_attempts
  WHERE event_hash IS NOT NULL
)
DELETE FROM public.practice_attempts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_practice_attempts_user_hash
  ON public.practice_attempts (user_id, event_hash)
  WHERE event_hash IS NOT NULL;