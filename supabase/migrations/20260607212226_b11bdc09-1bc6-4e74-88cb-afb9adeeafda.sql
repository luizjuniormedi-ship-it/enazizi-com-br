CREATE OR REPLACE FUNCTION public.check_competency_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.competency_id IS NOT NULL AND NEW.competency_id <> '' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.curriculum_registry 
            WHERE id = NEW.competency_id::uuid
        ) THEN
            RAISE EXCEPTION 'Competency ID % not found in registry', NEW.competency_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
