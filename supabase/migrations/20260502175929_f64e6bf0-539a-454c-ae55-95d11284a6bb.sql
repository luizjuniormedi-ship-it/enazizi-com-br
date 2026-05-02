-- Script para popular o rastreamento de estudo para os temas da P2
DO $$
DECLARE
    user_id_val UUID;
    tema TEXT;
    temas_clinica TEXT[] := ARRAY[
        'Câncer de pâncreas', 'Dissecção aórtica', 'Doença arterial obstrutiva periférica', 
        'Pericardite e Endocardite', 'Doenças Sexualmente Transmissíveis (DST)', 'Malária e Dengue', 
        'Pancreatite aguda/crônica e Litíase biliar', 'Pneumonias bacterianas', 'Micoses pulmonares', 
        'Câncer gástrico', 'Linfangites', 'Insuficiência arterial crônica', 
        'Introdução às arritmias cardíacas', 'Colagenoses (Lupus, Artrite)', 'Pneumonias atípicas', 
        'Doenças supurativas pulmonares', 'Esquistossomose mansoni', 'Hepatites agudas', 
        'Câncer hepatobiliar', 'Erisipela e Celulite', 'Doença linfática', 
        'Fibrilação atrial', 'Tumores cutâneos (Melanoma e não-melanoma)', 'DPOC', 
        'Tromboembolismo Pulmonar (TEP)', 'Câncer de pulmão', 'Isquemia cerebral extra-craniana', 
        'Estenose e insuficiência mitral', 'Psoríase', 'Leishmaniose visceral (Calazar)', 
        'Hepatites crônicas', 'Broncoscopia e Espirometria'
    ];
    temas_pediatria TEXT[] := ARRAY[
        'Interpretação de Hemograma e Gasometria Pediátrica', 'Doenças Exantemáticas I', 
        'Doenças Exantemáticas II', 'Síndrome Nefrótica na infância', 'Convulsões febris e Epilepsia', 
        'Artrite Reumatoide Juvenil', 'Febre Reumática', 
        'Aspectos Éticos do Atendimento ao Adolescente', 'Imunização no Adolescente'
    ];
    todos_temas TEXT[] := temas_clinica || temas_pediatria;
BEGIN
    SELECT id INTO user_id_val FROM auth.users LIMIT 1;

    IF user_id_val IS NOT NULL THEN
        FOREACH tema IN ARRAY todos_temas
        LOOP
            INSERT INTO public.tutor_study_tracking (
                user_id, topic, subject, interaction_count, total_study_time, 
                flashcards_generated, questions_answered, related_errors, updated_at
            ) VALUES (
                user_id_val, tema, 'Clínica Médica', 30, 1800, 10, 20, 8, now()
            )
            ON CONFLICT (user_id, topic) DO UPDATE SET
                interaction_count = 30,
                total_study_time = 1800,
                related_errors = 8,
                updated_at = now();
        END LOOP;
    END IF;
END $$;