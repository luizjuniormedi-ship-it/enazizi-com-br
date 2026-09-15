-- Repair questions_bank.curriculum_theme from canonical taxonomy.
--
-- Context:
-- A bulk ingestion contaminated curriculum_theme, especially by stamping many
-- non-Cardiology questions as "Cardiologia". The generator and UI must not
-- trust a stale curriculum_theme when normalized taxonomy or visible topic says
-- otherwise.
--
-- This migration does not create a parallel question system. It realigns the
-- existing canonical metadata from, in order:
--   1) questions_bank.specialty_id
--   2) questions_bank.topic_id
--   3) questions_bank.subtopic_id
--   4) exact textual match of questions_bank.topic/subtopic against taxonomy
--   5) exact textual match of questions_bank.topic against specialty names
--
-- It intentionally updates only rows where a canonical specialty can be inferred.

BEGIN;

CREATE TEMP TABLE _question_theme_repair AS
WITH inferred AS (
  SELECT
    qb.id,
    qb.curriculum_theme AS previous_curriculum_theme,
    COALESCE(
      spec_direct.nome,
      spec_from_topic_id.nome,
      spec_from_subtopic_id.nome,
      spec_from_topic_text.nome,
      spec_from_subtopic_text.nome,
      spec_from_legacy_topic_as_specialty.nome
    ) AS inferred_curriculum_theme
  FROM public.questions_bank qb
  LEFT JOIN public.curriculum_specialties spec_direct
    ON spec_direct.id = qb.specialty_id
  LEFT JOIN public.curriculum_topics topic_by_id
    ON topic_by_id.id = qb.topic_id
  LEFT JOIN public.curriculum_specialties spec_from_topic_id
    ON spec_from_topic_id.id = topic_by_id.specialty_id
  LEFT JOIN public.curriculum_subtopics subtopic_by_id
    ON subtopic_by_id.id = qb.subtopic_id
  LEFT JOIN public.curriculum_topics topic_from_subtopic_id
    ON topic_from_subtopic_id.id = subtopic_by_id.topic_id
  LEFT JOIN public.curriculum_specialties spec_from_subtopic_id
    ON spec_from_subtopic_id.id = topic_from_subtopic_id.specialty_id
  LEFT JOIN public.curriculum_topics topic_by_text
    ON lower(trim(topic_by_text.nome)) = lower(trim(qb.topic))
  LEFT JOIN public.curriculum_specialties spec_from_topic_text
    ON spec_from_topic_text.id = topic_by_text.specialty_id
  LEFT JOIN public.curriculum_subtopics subtopic_by_text
    ON lower(trim(subtopic_by_text.nome)) = lower(trim(COALESCE(qb.subtopic, qb.topic)))
  LEFT JOIN public.curriculum_topics topic_from_subtopic_text
    ON topic_from_subtopic_text.id = subtopic_by_text.topic_id
  LEFT JOIN public.curriculum_specialties spec_from_subtopic_text
    ON spec_from_subtopic_text.id = topic_from_subtopic_text.specialty_id
  LEFT JOIN public.curriculum_specialties spec_from_legacy_topic_as_specialty
    ON lower(trim(spec_from_legacy_topic_as_specialty.nome)) = lower(trim(qb.topic))
)
SELECT *
FROM inferred
WHERE inferred_curriculum_theme IS NOT NULL
  AND COALESCE(trim(previous_curriculum_theme), '') <> inferred_curriculum_theme;

DO $$
DECLARE
  v_total integer;
  v_cardio_fixed integer;
BEGIN
  SELECT count(*) INTO v_total FROM _question_theme_repair;
  SELECT count(*) INTO v_cardio_fixed
  FROM _question_theme_repair
  WHERE previous_curriculum_theme = 'Cardiologia'
    AND inferred_curriculum_theme <> 'Cardiologia';

  RAISE NOTICE 'questions_bank curriculum_theme repair candidates: %, previous Cardiologia reclassified: %',
    v_total,
    v_cardio_fixed;
END $$;

UPDATE public.questions_bank qb
SET curriculum_theme = r.inferred_curriculum_theme
FROM _question_theme_repair r
WHERE qb.id = r.id;

-- Hard validation for the known production failure mode. If this still fails,
-- the data requires explicit editorial quarantine instead of publication.
DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT count(*)
  INTO v_remaining
  FROM public.questions_bank qb
  WHERE qb.curriculum_theme = 'Cardiologia'
    AND lower(trim(COALESCE(qb.topic, ''))) IN (
      'pediatria',
      'anestesiologia',
      'endocrinologia',
      'nutrição',
      'nutricao',
      'gastroenterologia',
      'tratamento da depressão',
      'tratamento da depressao'
    );

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'questions_bank curriculum_theme repair incomplete: % visibly non-Cardiology rows remain stamped as Cardiologia',
      v_remaining;
  END IF;
END $$;

DROP TABLE _question_theme_repair;

COMMIT;
