-- Enforce exactly 4 options and NOT NULL critical fields
ALTER TABLE public.questions_bank 
ADD CONSTRAINT check_options_count CHECK (jsonb_array_length(options) = 4),
ALTER COLUMN statement SET NOT NULL,
ALTER COLUMN options SET NOT NULL,
ALTER COLUMN correct_index SET NOT NULL,
ALTER COLUMN explanation SET NOT NULL;

-- Function to validate Gold Standard before insert/update
CREATE OR REPLACE FUNCTION public.validate_question_gold_standard()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce 450+ characters for statement
    IF char_length(NEW.statement) < 450 THEN
        RAISE EXCEPTION 'A questão não atende ao Padrão Ouro: Enunciado deve ter pelo menos 450 caracteres.';
    END IF;

    -- Ensure options are not empty strings
    IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(NEW.options) AS opt WHERE opt = '' OR opt IS NULL) THEN
        RAISE EXCEPTION 'A questão possui alternativas vazias ou nulas.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for validation (only for new/updated questions, ignoring historical data if already preserved)
-- However, we want strict enforcement for all from now on.
CREATE TRIGGER tr_validate_question_gold_standard
BEFORE INSERT OR UPDATE ON public.questions_bank
FOR EACH ROW
EXECUTE FUNCTION public.validate_question_gold_standard();
