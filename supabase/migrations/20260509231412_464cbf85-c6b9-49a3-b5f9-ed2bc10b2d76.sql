CREATE OR REPLACE FUNCTION public.compute_assistant_decision_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.compute_practice_attempt_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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