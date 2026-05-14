-- Adjust validation function to only target GOLDEN tier
CREATE OR REPLACE FUNCTION public.validate_question_gold_standard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Apply strict validation ONLY to GOLDEN tier questions
    IF NEW.quality_tier = 'GOLDEN' THEN
        -- Enforce 450+ characters for statement
        IF char_length(NEW.statement) < 450 THEN
            RAISE EXCEPTION 'A questão não atende ao Padrão Ouro: Enunciado deve ter pelo menos 450 caracteres.';
        END IF;

        -- Ensure options are not empty strings
        IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.options) AS opt WHERE opt = '' OR opt IS NULL) THEN
            RAISE EXCEPTION 'A questão GOLDEN possui alternativas vazias ou nulas.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 1. GOLDEN DATASET: High-Quality Questions (Distributed by Specialty)
INSERT INTO public.questions_bank (
  user_id, source, statement, options, correct_index, explanation, topic, subtopic, difficulty, quality_tier, cognitive_quality_score, hallucination_risk_score, clinical_reasoning_depth, language, is_global
) VALUES 
('d342be08-4a6a-4183-94a0-fce42255cec1', 'ENAZIZI_WARMUP', 'Paciente masculino, 67 anos, tabagista ativo de longa data com uma carga tabágica estimada em aproximadamente 50 maços-ano e portador de hipertensão arterial sistêmica em uso irregular de medicação anti-hipertensiva, procura o serviço de atendimento de emergência com queixa principal de dor torácica retroesternal de caráter opressivo e de forte intensidade, referindo nota 9 em 10 na escala visual analógica. O paciente relata que o quadro doloroso se iniciou há aproximadamente 120 minutos enquanto estava em repouso domiciliar. Refere ainda que a dor apresenta irradiação para a mandíbula e para o membro superior esquerdo, acompanhada de sudorese profusa. Ao exame físico na sala de emergência: paciente apresenta-se ansioso, pálido e com perfusão periférica lentificada. Sinais vitais: PA 155/95 mmHg, FC 102 bpm, FR 20 irpm e SatO2 93% em ar ambiente. O eletrocardiograma (ECG) demonstra um supra-desnivelamento do segmento ST de 3 mm nas derivações precordiais de V1 a V4. Com base no diagnóstico de Infarto Agudo do Miocárdio com supra de ST (IAMCSST) de parede anterior, qual é a conduta terapêutica imediata mais recomendada conforme as diretrizes nacionais e internacionais atuais para o ano de 2024?', '["AAS 300mg mastigado + Clopidogrel 300mg + Reperfusão imediata via ICP primária", "Monitorização contínua e dosagem de troponina ultra-sensível antes de qualquer intervenção", "Administração de Nitrato sublingual isolado e reavaliação do ECG em 6 horas", "Fibrinólise imediata independentemente da disponibilidade de laboratório de hemodinâmica"]', 0, 'O quadro clínico de dor torácica típica associado ao ECG com supra-ST em derivações precordiais (V1-V4) confirma IAMCSST de parede anterior. A conduta padrão ouro é a dupla antiagregação plaquetária imediata e a estratégia de reperfusão, preferencialmente por intervenção coronariana percutânea (ICP) primária se disponível em tempo hábil (<120 min). Referência: Diretriz da Sociedade Brasileira de Cardiologia 2024.', 'Clínica Médica', 'Cardiologia - IAM', 3, 'GOLDEN', 0.98, 0.02, 5, 'pt-BR', true);

-- 2. NEGATIVE DATASET: Rejection Examples
INSERT INTO public.questions_bank (
  user_id, source, statement, options, correct_index, explanation, topic, subtopic, difficulty, quality_tier, cognitive_quality_score, hallucination_risk_score, review_status, language, is_global
) VALUES 
('d342be08-4a6a-4183-94a0-fce42255cec1', 'ENAZIZI_NEGATIVE', 'O que é febre?', '["Aumento da temperatura", "Nada", "Frio", "Calor"]', 0, 'Resposta muito superficial.', 'Geral', 'Semiologia', 1, 'REJECTED', 0.2, 0.8, 'rejected', 'pt-BR', true);

-- 3. ERROR BANK POPULATION
INSERT INTO public.error_bank (
  user_id, tema, subtema, categoria_erro, motivo_erro, dificuldade, vezes_errado, dominado
) VALUES 
('d342be08-4a6a-4183-94a0-fce42255cec1', 'Clínica Médica', 'Cardiologia', 'Conceitual', 'Confusão entre indicação de angioplastia e fibrinólise no IAMCSST', 3, 5, false);

-- 4. SHADOW METRICS BASELINE
INSERT INTO public.shadow_adaptive_metrics (
  metric_type, original_value, shadow_value, divergence_score, metadata, user_id
) VALUES 
('pedagogical_baseline', '{"quality": 0.5}', '{"quality": 0.9}', 0.4, '{"phase": "warmup_start"}', 'd342be08-4a6a-4183-94a0-fce42255cec1');