-- Unification Migration v3: real_exam_questions -> questions_bank

-- 1. Create a temporary function to handle the migration safely
CREATE OR REPLACE FUNCTION public.migrate_real_to_bank()
RETURNS void AS $$
DECLARE
    admin_id UUID;
BEGIN
    -- Get the admin user ID (from context or default admin)
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@enazizi.com.br' LIMIT 1;
    IF admin_id IS NULL THEN
        SELECT id INTO admin_id FROM auth.users LIMIT 1;
    END IF;

    -- Insert questions from real_exam_questions that don't exist in questions_bank
    INSERT INTO public.questions_bank (
        statement,
        options,
        correct_index,
        explanation,
        topic,
        subtopic,
        difficulty,
        difficulty_level,
        is_clinical_case,
        tags,
        board,
        institution,
        year,
        source,
        source_type,
        is_global,
        review_status,
        quality_tier,
        user_id,
        created_at
    )
    SELECT 
        r.statement,
        r.options,
        -- Correct index must be 0-4. If < 0 (anulada), default to 0 and note in explanation.
        CASE 
            WHEN r.correct_index IS NULL OR r.correct_index < 0 OR r.correct_index > 4 THEN 0 
            ELSE r.correct_index 
        END,
        COALESCE(r.explanation, 'Sem explicação disponível.'),
        COALESCE(r.topic, 'Geral'),
        r.subtopic,
        COALESCE(r.difficulty, 3),
        COALESCE(r.difficulty_level, 3),
        COALESCE(r.is_clinical_case, false),
        COALESCE(r.tags, ARRAY[]::text[]),
        r.board,
        r.institution,
        -- Year must be >= 1900 based on possible constraints
        CASE 
            WHEN r.year IS NULL OR r.year < 1900 THEN 2024 
            ELSE r.year 
        END,
        COALESCE(r.exam_info, r.source_file, 'Drive Médico'),
        'official_exam',
        true,
        'approved',
        'gold',
        admin_id,
        r.created_at
    FROM public.real_exam_questions r
    WHERE r.is_active = true
    AND r.statement IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.questions_bank b 
        WHERE b.statement = r.statement
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Execute migration
SELECT public.migrate_real_to_bank();

-- 3. Drop temporary function
DROP FUNCTION public.migrate_real_to_bank();

-- 4. Update get_login_stats to reflect unified bank
CREATE OR REPLACE FUNCTION public.get_login_stats()
RETURNS TABLE(alunos bigint, questoes bigint, flashcards bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE user_type = 'estudante'),
    (SELECT count(*) FROM public.questions_bank WHERE is_global = true),
    (SELECT count(*) FROM public.flashcards);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
