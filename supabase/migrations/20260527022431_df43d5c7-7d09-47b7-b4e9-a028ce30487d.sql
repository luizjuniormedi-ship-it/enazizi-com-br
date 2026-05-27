
CREATE OR REPLACE FUNCTION public.fanout_simulado_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_topic text;
  v_exists boolean;
BEGIN
  v_topic := COALESCE(NEW.specialty, 'Geral');

  IF NEW.bank_question_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.questions_bank WHERE id = NEW.bank_question_id) INTO v_exists;
    IF v_exists THEN
      v_hash := 'sim:' || NEW.simulado_session_id::text || ':' || COALESCE(NEW.question_index::text,'x');
      BEGIN
        INSERT INTO public.practice_attempts (user_id, question_id, correct, event_hash, created_at)
        VALUES (NEW.user_id, NEW.bank_question_id, COALESCE(NEW.is_correct, false), v_hash, COALESCE(NEW.created_at, now()))
        ON CONFLICT (user_id, event_hash) WHERE event_hash IS NOT NULL DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[FANOUT_PA_FAIL] % %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  IF COALESCE(NEW.is_correct, true) = false THEN
    BEGIN
      INSERT INTO public.error_bank (user_id, tema, subtema, question_id, vezes_errado, dominado, tema_norm, subtema_norm, created_at, updated_at)
      VALUES (NEW.user_id, v_topic, NEW.subtopic, NEW.bank_question_id, 1, false, lower(v_topic), lower(COALESCE(NEW.subtopic,'')), now(), now())
      ON CONFLICT (user_id, tema, COALESCE(subtema, ''::text), COALESCE(question_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET vezes_errado = public.error_bank.vezes_errado + 1, updated_at = now(), dominado = false;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[ERROR_BANK_FAIL] %', SQLERRM; END;
  END IF;

  BEGIN
    INSERT INTO public.user_topic_profiles (user_id, topic, specialty, total_questions, correct_answers, accuracy, last_practiced_at, created_at, updated_at)
    VALUES (NEW.user_id, v_topic, v_topic, 1, CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
            CASE WHEN NEW.is_correct THEN 100.0 ELSE 0.0 END, now(), now(), now())
    ON CONFLICT (user_id, topic) DO UPDATE SET
      total_questions = public.user_topic_profiles.total_questions + 1,
      correct_answers = public.user_topic_profiles.correct_answers + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      accuracy = ROUND(((public.user_topic_profiles.correct_answers + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::numeric
                       / NULLIF(public.user_topic_profiles.total_questions + 1, 0)::numeric) * 100.0, 2),
      last_practiced_at = now(), updated_at = now();
  EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[UTP_FAIL] %', SQLERRM; END;

  IF NEW.bank_question_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.fsrs_cards (user_id, card_type, card_ref_id, topic, state, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, due, created_at, updated_at)
      VALUES (NEW.user_id, 'question', NEW.bank_question_id::text, v_topic, 0, 0,
              CASE WHEN NEW.is_correct THEN 5 ELSE 7 END, 0, 0, 0,
              CASE WHEN NEW.is_correct THEN 0 ELSE 1 END, now() + interval '1 day', now(), now())
      ON CONFLICT (user_id, card_type, card_ref_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE '[FSRS_FAIL] %', SQLERRM; END;
  END IF;

  RETURN NEW;
END;
$$;
