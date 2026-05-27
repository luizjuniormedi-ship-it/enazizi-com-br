
-- ============================================================
-- ENAZIZI P0 — FAN-OUT TRIGGERS (cognitive pipeline reconnect)
-- ============================================================

-- 1) FAN-OUT por resposta de simulado
CREATE OR REPLACE FUNCTION public.fanout_simulado_answer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_topic text;
BEGIN
  v_topic := COALESCE(NEW.specialty, 'Geral');

  -- 1.1 practice_attempts (idempotente por session+index)
  IF NEW.bank_question_id IS NOT NULL THEN
    v_hash := 'sim:' || NEW.simulado_session_id::text || ':' || COALESCE(NEW.question_index::text,'x');
    BEGIN
      INSERT INTO public.practice_attempts (user_id, question_id, correct, event_hash, created_at)
      VALUES (NEW.user_id, NEW.bank_question_id, COALESCE(NEW.is_correct, false), v_hash, COALESCE(NEW.created_at, now()))
      ON CONFLICT (user_id, event_hash) WHERE event_hash IS NOT NULL DO NOTHING;
      RAISE NOTICE '[FANOUT_PA_OK] %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[FANOUT_PA_FAIL] % %', NEW.id, SQLERRM;
    END;
  END IF;

  -- 1.2 error_bank (somente em erros)
  IF COALESCE(NEW.is_correct, true) = false THEN
    BEGIN
      INSERT INTO public.error_bank (
        user_id, tema, subtema, question_id, vezes_errado, dominado,
        tema_norm, subtema_norm, created_at, updated_at
      )
      VALUES (
        NEW.user_id, v_topic, NEW.subtopic, NEW.bank_question_id, 1, false,
        lower(v_topic), lower(COALESCE(NEW.subtopic,'')), now(), now()
      )
      ON CONFLICT (user_id, tema, COALESCE(subtema, ''::text), COALESCE(question_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET
        vezes_errado = public.error_bank.vezes_errado + 1,
        updated_at = now(),
        dominado = false;
      RAISE NOTICE '[ERROR_BANK_UPSERT_OK] %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[ERROR_BANK_UPSERT_FAIL] % %', NEW.id, SQLERRM;
    END;
  END IF;

  -- 1.3 user_topic_profiles (acumula acertos/total, recalcula accuracy)
  BEGIN
    INSERT INTO public.user_topic_profiles (
      user_id, topic, specialty, total_questions, correct_answers, accuracy,
      last_practiced_at, created_at, updated_at
    )
    VALUES (
      NEW.user_id, v_topic, v_topic, 1,
      CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      CASE WHEN NEW.is_correct THEN 100.0 ELSE 0.0 END,
      now(), now(), now()
    )
    ON CONFLICT (user_id, topic) DO UPDATE SET
      total_questions = public.user_topic_profiles.total_questions + 1,
      correct_answers = public.user_topic_profiles.correct_answers + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
      accuracy = ROUND(
        ((public.user_topic_profiles.correct_answers + CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)::numeric
         / NULLIF(public.user_topic_profiles.total_questions + 1, 0)::numeric) * 100.0, 2),
      last_practiced_at = now(),
      updated_at = now();
    RAISE NOTICE '[UTP_UPSERT_OK] %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[UTP_UPSERT_FAIL] % %', NEW.id, SQLERRM;
  END;

  -- 1.4 fsrs_cards (cria pendente; não toca em existente)
  IF NEW.bank_question_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.fsrs_cards (
        user_id, card_type, card_ref_id, topic, state, stability, difficulty,
        elapsed_days, scheduled_days, reps, lapses, due, created_at, updated_at
      )
      VALUES (
        NEW.user_id, 'question', NEW.bank_question_id::text, v_topic,
        0, 0, CASE WHEN NEW.is_correct THEN 5 ELSE 7 END,
        0, 0, 0, CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
        now() + interval '1 day', now(), now()
      )
      ON CONFLICT (user_id, card_type, card_ref_id) DO NOTHING;
      RAISE NOTICE '[FSRS_SEED_OK] %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[FSRS_SEED_FAIL] % %', NEW.id, SQLERRM;
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


-- 2) FAN-OUT ao finalizar simulado → snapshot cognitivo
CREATE OR REPLACE FUNCTION public.fanout_simulado_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rt numeric;
  v_acc numeric;
  v_fatigue numeric;
  v_retention numeric;
  v_theta numeric;
  v_weak jsonb;
BEGIN
  IF NEW.status <> 'finished' OR COALESCE(OLD.status,'') = 'finished' THEN
    RETURN NEW;
  END IF;

  -- métricas determinísticas a partir das respostas dessa sessão
  SELECT
    AVG(response_time_seconds)::numeric,
    AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END)::numeric
  INTO v_avg_rt, v_acc
  FROM public.simulado_question_analytics
  WHERE simulado_session_id = NEW.id;

  v_fatigue := LEAST(1.0, GREATEST(0.0, COALESCE(v_avg_rt,0) / 60.0));
  v_retention := COALESCE(v_acc, NEW.score/100.0);
  -- theta IRT simplificado: logit(acurácia) limitado
  v_theta := CASE
    WHEN v_acc IS NULL OR v_acc <= 0.01 THEN -2.0
    WHEN v_acc >= 0.99 THEN 2.0
    ELSE LN(v_acc / (1 - v_acc))
  END;

  SELECT COALESCE(jsonb_agg(DISTINCT specialty) FILTER (WHERE specialty IS NOT NULL), '[]'::jsonb)
  INTO v_weak
  FROM public.simulado_question_analytics
  WHERE simulado_session_id = NEW.id AND is_correct = false;

  BEGIN
    INSERT INTO public.cognitive_state_snapshots (
      user_id, fatigue_score, retention_score, overload_score, engagement_score,
      abandonment_risk, fsrs_pressure, current_theta, weak_specialties, created_at
    )
    VALUES (
      NEW.user_id, v_fatigue, v_retention,
      CASE WHEN v_fatigue > 0.7 THEN 0.8 ELSE 0.2 END,
      0.9,
      CASE WHEN v_fatigue > 0.9 THEN 0.5 ELSE 0.1 END,
      (SELECT COUNT(*) FROM public.fsrs_cards WHERE user_id = NEW.user_id AND due <= now())::numeric / 100.0,
      v_theta, v_weak, now()
    );
    RAISE NOTICE '[COG_SNAPSHOT_OK] session=%', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[COG_SNAPSHOT_FAIL] session=% %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_simulado_finish ON public.simulado_sessions;
CREATE TRIGGER trg_fanout_simulado_finish
AFTER UPDATE OF status ON public.simulado_sessions
FOR EACH ROW
WHEN (NEW.status = 'finished' AND COALESCE(OLD.status,'') <> 'finished')
EXECUTE FUNCTION public.fanout_simulado_finish();
