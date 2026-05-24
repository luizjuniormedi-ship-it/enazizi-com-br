-- 1. Identificar um usuário admin para ser o "dono" do sistema das questões globais
-- Usaremos o primeiro usuário encontrado no sistema
DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM auth.users LIMIT 1;

    -- 2. Inserir questões da real_exam_questions
    INSERT INTO public.questions_bank (
        user_id,
        statement, 
        options, 
        correct_index, 
        explanation, 
        topic, 
        subtopic, 
        difficulty, 
        source_type, 
        is_global, 
        review_status,
        institution,
        year,
        board,
        official_exam_flag
    )
    SELECT 
        admin_id,
        statement, 
        options, 
        correct_index, 
        explanation, 
        topic, 
        subtopic, 
        COALESCE(difficulty, 3), 
        'official_exam', 
        true, 
        'approved',
        institution,
        year,
        board,
        true
    FROM public.real_exam_questions req
    WHERE NOT EXISTS (
        SELECT 1 FROM public.questions_bank qb 
        WHERE qb.statement = req.statement
    );

    -- 3. Inserir questões da medical_image_questions
    INSERT INTO public.questions_bank (
        user_id,
        statement, 
        options, 
        correct_index, 
        explanation, 
        topic, 
        difficulty, 
        source_type, 
        is_global, 
        review_status,
        is_clinical_case
    )
    SELECT 
        admin_id,
        statement, 
        jsonb_build_array(option_a, option_b, option_c, option_d, option_e), 
        correct_index, 
        explanation, 
        'Radiologia e Imagem', 
        CASE 
            WHEN difficulty::text = 'easy' THEN 1
            WHEN difficulty::text = 'medium' THEN 3
            WHEN difficulty::text = 'hard' THEN 5
            ELSE 3
        END,
        'medical_image', 
        true, 
        'approved',
        true
    FROM public.medical_image_questions miq
    WHERE NOT EXISTS (
        SELECT 1 FROM public.questions_bank qb 
        WHERE qb.statement = miq.statement
    );

    -- 4. Garantir consistência global
    UPDATE public.questions_bank 
    SET is_global = true, 
        review_status = 'approved',
        user_id = COALESCE(user_id, admin_id)
    WHERE is_global = false OR review_status != 'approved' OR user_id IS NULL;
END $$;