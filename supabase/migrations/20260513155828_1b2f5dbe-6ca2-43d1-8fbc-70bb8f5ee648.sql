-- Update clinical_quality_profiles to avoid o1-preview/o1 models which are restricted
UPDATE public.clinical_quality_profiles
SET preferred_model = 'openai/gpt-5-mini'
WHERE preferred_model IN ('o1-preview', 'o1', 'o1-mini');

UPDATE public.clinical_quality_profiles
SET fallback_model = 'openai/gpt-5'
WHERE fallback_model IN ('o1-preview', 'o1', 'o1-mini');

-- Also update standard defaults just in case
UPDATE public.clinical_quality_profiles
SET preferred_model = 'openai/gpt-5-mini'
WHERE preferred_model = 'gpt-4o-mini';

UPDATE public.clinical_quality_profiles
SET fallback_model = 'openai/gpt-5'
WHERE fallback_model = 'gpt-4o';
