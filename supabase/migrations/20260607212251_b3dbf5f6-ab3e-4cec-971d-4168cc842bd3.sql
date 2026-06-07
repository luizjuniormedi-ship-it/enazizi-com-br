CREATE OR REPLACE FUNCTION public.enforce_promotion_policy()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.classification_status = 'promoted' THEN
        -- Teste D: Dois classificadores discordam
        IF (NEW.classification_a->>'competency_id' <> NEW.classification_b->>'competency_id') 
           AND (NEW.audit_status NOT IN ('approved', 'verified')) THEN
            RAISE EXCEPTION 'MANUAL REVIEW REQUIRED: Classifiers disagree on staging_id %', NEW.id;
        END IF;

        -- Meta: Quality Gate
        IF (NEW.quality_score < 80) AND (NEW.audit_status NOT IN ('approved', 'verified')) THEN
            RAISE EXCEPTION 'QUALITY GATE FAILED: Score % is below threshold for staging_id %', NEW.quality_score, NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
