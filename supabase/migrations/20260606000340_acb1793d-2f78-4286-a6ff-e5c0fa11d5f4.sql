-- 1. Função para remover acentos e normalizar texto para comparação
CREATE OR REPLACE FUNCTION public.normalize_text(txt TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(unaccent(txt));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Trigger para preencher specialty_id automaticamente
CREATE OR REPLACE FUNCTION public.sync_question_specialty()
RETURNS TRIGGER AS $$
DECLARE
    found_id UUID;
BEGIN
    -- Se specialty_id for nulo, tenta encontrar pelo tópico
    IF NEW.specialty_id IS NULL AND NEW.topic IS NOT NULL THEN
        SELECT id INTO found_id 
        FROM public.curriculum_specialties 
        WHERE public.normalize_text(nome) = public.normalize_text(NEW.topic)
        LIMIT 1;
        
        IF found_id IS NOT NULL THEN
            NEW.specialty_id := found_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_question_specialty ON public.questions_bank;
CREATE TRIGGER trg_sync_question_specialty
BEFORE INSERT OR UPDATE ON public.questions_bank
FOR EACH ROW EXECUTE FUNCTION public.sync_question_specialty();

-- 3. Atualizar RPC de contagem para ser mais inteligente
CREATE OR REPLACE FUNCTION public.get_questions_topic_counts()
 RETURNS TABLE(topic text, count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Primeiro pegamos as contagens pelas especialidades reais vinculadas
  SELECT s.nome as topic, count(*) as count
  FROM questions_bank q
  JOIN curriculum_specialties s ON q.specialty_id = s.id
  WHERE q.is_global = true
  GROUP BY s.nome
  
  UNION ALL
  
  -- Depois pegamos tópicos que NÃO estão vinculados a especialidades (para não perder dados)
  SELECT q.topic, count(*) as count
  FROM questions_bank q
  WHERE q.is_global = true AND q.specialty_id IS NULL
  GROUP BY q.topic;
$function$;

-- 4. Backfill: Corrigir questões existentes que estão sem specialty_id
UPDATE public.questions_bank q
SET specialty_id = s.id
FROM public.curriculum_specialties s
WHERE q.specialty_id IS NULL 
  AND q.topic IS NOT NULL
  AND public.normalize_text(q.topic) = public.normalize_text(s.nome);

GRANT SELECT ON public.curriculum_specialties TO authenticated;
GRANT SELECT ON public.curriculum_specialties TO service_role;
GRANT EXECUTE ON FUNCTION public.get_questions_topic_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_questions_topic_counts() TO service_role;
