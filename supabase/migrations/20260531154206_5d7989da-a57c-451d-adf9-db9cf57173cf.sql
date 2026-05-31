DROP VIEW IF EXISTS public.vw_clinica_medica_umbrella;

CREATE VIEW public.vw_clinica_medica_umbrella
WITH (security_invoker = true) AS
SELECT 
  qb.*,
  CASE 
    WHEN qb.specialty_id = 'c6323be9-8b39-4e72-b267-2f19e0980abb' THEN 'nativa'
    ELSE 'sub_especialidade'
  END AS umbrella_origem
FROM public.questions_bank qb
WHERE qb.review_status = 'approved'
  AND qb.specialty_id IN (
    'c6323be9-8b39-4e72-b267-2f19e0980abb',
    '038fc7d1-5a03-441a-8ae3-933204803cce',
    '4235da65-61b9-4fbd-9ff0-344cf986f311',
    '64565205-940f-4c4b-9614-af7fed8a3818',
    'c87f3381-d1de-4289-a8e4-565ac0d950a1',
    'f9242f6f-df6f-40d7-a04e-8bbffb215645',
    'd20d5adf-20f9-4789-8a86-0e07109c9192',
    '0b755bbe-9dde-475f-a2ef-5733d8d97c99',
    'b47c8eb7-94ee-4b63-bf35-d5b6494b8866',
    'c835d457-412d-4d22-a7ea-ca33cc5bca1a',
    'ee8bf227-3be0-43ad-bd3e-e855c71b1d5b'
  );

GRANT SELECT ON public.vw_clinica_medica_umbrella TO authenticated, service_role;