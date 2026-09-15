-- P0 repair: restore the canonical Simulados -> practice_attempts -> FSRS fanout.
--
-- The real E2E failure is:
--   simulado_question_analytics rows are created, all bank-backed,
--   but practice_attempts remains empty.
--
-- This migration is intentionally idempotent and must be applied only to the
-- canonical ENAZIZI Supabase project: qszsyskumcmuknumwxtk.
-- Do not apply it to the stale/local linked project.

-- Legacy synchronous mastery trigger references removed columns and can abort
-- practice_attempts inserts. Domain/proficiency refresh is handled elsewhere.
DROP TRIGGER IF EXISTS tr_refresh_mastery_on_practice ON public.practice_attempts;
DROP FUNCTION IF EXISTS public.refresh_domain_mastery();

CREATE OR REPLACE FUNCTION public.fanout_simulado_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_topic text;
  v_question_exists boolean;
BEGIN
  v_topic := COALESCE(NULLIF(NEW.specialty, ''), 'Geral');

  -- 1) Canonical attempt evidence for FSRS/TRI/readiness.
  -- Only bank-backed UUID questions can satisfy practice_attempts.question_id.
  IF NEW.bank_question_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.questions_bank WHERE id = NEW.bank_question_id
    )
    INTO v_question_exists;

    IF v_question_exists THEN
      v_hash := 'sim:' || NEW.simulado_session_id::text || ':' || COALESCE(NEW.question_index::text, 'x');

      BEGIN
        INSERT INTO public.practice_attempts (
          user_id,
          question_id,
          correct,
          event_hash,
          created_at
        )
        VALUES (
          NEW.user_id,
          NEW.bank_question_id,
          COALESCE(NEW.is_correct, false),
          v_hash,
          COALESCE(NEW.created_at, now())
        )
        ON CONFLICT (user_id, event_hash) WHERE event_hash IS NOT NULL DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[FANOUT_PA_FAIL] analytics_id=% sqlstate=% message=%', NEW.id, SQLSTATE, SQLERRM;
      END;
    ELSE
      RAISE NOTICE '[FANOUT_PA_SKIP] analytics_id=% reason=missing_bank_question bank_question_id=%', NEW.id, NEW.bank_question_id;
    END IF;
  END IF;

  -- 2) Error bank remains best-effort. It must never block answer evidence.
  IF COALESCE(NEW.is_correct, true) = false THEN
    BEGIN
      INSERT INTO public.error_bank (
        user_id,
        tema,
        subtema,
        question_id,
        vezes_errado,
        dominado,
        tema_norm,
        subtema_norm,
        created_at,
        updated_at
      )
      VALUES (
        NEW.user_id,
        v_topic,
        NEW.subtopic,
        NEW.bank_question_id,
        1,
        false,
        lower(v_topic),
        lower(COALESCE(NEW.subtopic, '')),
        now(),
        now()
      )
      ON CONFLICT (
        user_id,
        tema,
        COALESCE(subtema, ''::text),
        COALESCE(question_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      DO UPDATE SET
        vezes_errado = public.error_bank.vezes_errado + 1,
        updated_at = now(),
        dominado = false;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[FANOUT_ERROR_BANK_FAIL] analytics_id=% sqlstate=% message=%', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  -- 3) Topic profile is best-effort. It must never block practice_attempts.
  BEGIN
    INSERT INTO public.user_topic_profiles (
      user_id,
      topic,
      specialty,
      total_questions,
      correct_answers,
      accuracy,
      last_practiced_at,
      created_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      v_topic,
      v_topic,
      1,
      CASE WHEN COALESCE(NEW.is_correct, false) THEN 1 ELSE 0 END,
      CASE WHEN COALESCE(NEW.is_correct, false) THEN 100.0 ELSE 0.0 END,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, topic) DO UPDATE SET
      total_questions = public.user_topic_profiles.total_questions + 1,
      correct_answers = public.user_topic_profiles.correct_answers + CASE WHEN COALESCE(NEW.is_correct, false) THEN 1 ELSE 0 END,
      accuracy = ROUND(
        (
          (public.user_topic_profiles.correct_answers + CASE WHEN COALESCE(NEW.is_correct, false) THEN 1 ELSE 0 END)::numeric
          / NULLIF(public.user_topic_profiles.total_questions + 1, 0)::numeric
        ) * 100.0,
        2
      ),
      last_practiced_at = now(),
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[FANOUT_TOPIC_PROFILE_FAIL] analytics_id=% sqlstate=% message=%', NEW.id, SQLSTATE, SQLERRM;
  END;

  -- 4) Seed question FSRS card once. Existing cards are preserved.
  IF NEW.bank_question_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.fsrs_cards (
        user_id,
        card_type,
        card_ref_id,
        topic,
        state,
        stability,
        difficulty,
        elapsed_days,
        scheduled_days,
        reps,
        lapses,
        due,
        created_at,
        updated_at
      )
      VALUES (
        NEW.user_id,
        'question',
        NEW.bank_question_id::text,
        v_topic,
        0,
        0,
        CASE WHEN COALESCE(NEW.is_correct, false) THEN 5 ELSE 7 END,
        0,
        0,
        0,
        CASE WHEN COALESCE(NEW.is_correct, false) THEN 0 ELSE 1 END,
        now() + interval '1 day',
        now(),
        now()
      )
      ON CONFLICT (user_id, card_type, card_ref_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[FANOUT_FSRS_FAIL] analytics_id=% sqlstate=% message=%', NEW.id, SQLSTATE, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_simulado_answer ON public.simulado_question_analytics;
CREATE TRIGGER trg_fanout_simulado_answer
AFTER INSERT ON public.simulado_question_analytics
FOR EACH ROW
EXECUTE FUNCTION public.fanout_simulado_answer();

COMMENT ON FUNCTION public.fanout_simulado_answer() IS
  'Canonical ENAZIZI fanout: simulado_question_analytics -> practice_attempts/error_bank/user_topic_profiles/fsrs_cards. Repaired 2026-09-15.';
