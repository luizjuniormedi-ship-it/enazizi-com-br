-- Tabela de aliases curriculares
CREATE TABLE IF NOT EXISTS public.curriculum_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  specialty_id uuid NULL REFERENCES public.curriculum_specialties(id) ON DELETE CASCADE,
  topic_id uuid NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
  subtopic_id uuid NULL REFERENCES public.curriculum_subtopics(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'seed',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_aliases_target_check CHECK (
    (specialty_id IS NOT NULL)::int +
    (topic_id IS NOT NULL)::int +
    (subtopic_id IS NOT NULL)::int >= 1
  )
);

-- Unicidade do alias normalizado quando ativo (evita duplicatas conflitantes)
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_aliases_normalized_unique
  ON public.curriculum_aliases (normalized_alias)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS curriculum_aliases_active_idx
  ON public.curriculum_aliases (active);

-- Trigger updated_at
DROP TRIGGER IF EXISTS curriculum_aliases_set_updated_at ON public.curriculum_aliases;
CREATE TRIGGER curriculum_aliases_set_updated_at
BEFORE UPDATE ON public.curriculum_aliases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.curriculum_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read aliases"
ON public.curriculum_aliases
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage aliases insert"
ON public.curriculum_aliases
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage aliases update"
ON public.curriculum_aliases
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage aliases delete"
ON public.curriculum_aliases
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial: aliases mapeados para specialties existentes (por nome canônico)
-- Helper inline: insere alias só se a specialty alvo existir e o alias normalizado ainda não estiver registrado.
WITH seeds(alias, normalized_alias, specialty_name) AS (
  VALUES
    ('Ginecologia e Obstetrícia',         'ginecologia e obstetricia',           'Ginecologia e Obstetrícia'),
    ('GO',                                'go',                                  'Ginecologia e Obstetrícia'),
    ('Gineco',                            'gineco',                              'Ginecologia e Obstetrícia'),
    ('Obstetrícia',                       'obstetricia',                         'Ginecologia e Obstetrícia'),
    ('Cirurgia Geral',                    'cirurgia geral',                      'Cirurgia'),
    ('Cirurgia',                          'cirurgia',                            'Cirurgia'),
    ('Emergência',                        'emergencia',                          'Medicina de Emergência'),
    ('Pronto Socorro',                    'pronto socorro',                      'Medicina de Emergência'),
    ('PS',                                'ps',                                  'Medicina de Emergência'),
    ('Urgência e Emergência',             'urgencia e emergencia',               'Medicina de Emergência'),
    ('Medicina de Emergência',            'medicina de emergencia',              'Medicina de Emergência'),
    ('Clínica Médica - Exame Neurológico','clinica medica exame neurologico',    'Clínica Médica'),
    ('Clínica Médica - Exame Físico Geral','clinica medica exame fisico geral',  'Clínica Médica'),
    ('Clínica Médica - Exame Físico',     'clinica medica exame fisico',         'Clínica Médica'),
    ('Clínica Médica',                    'clinica medica',                      'Clínica Médica'),
    ('Medicina Interna',                  'medicina interna',                    'Clínica Médica'),
    ('Medicina Preventiva',               'medicina preventiva',                 'Medicina Preventiva e Social'),
    ('Preventiva',                        'preventiva',                          'Medicina Preventiva e Social'),
    ('Saúde Pública',                     'saude publica',                       'Medicina Preventiva e Social'),
    ('Saúde Coletiva',                    'saude coletiva',                      'Medicina Preventiva e Social'),
    ('Epidemiologia',                     'epidemiologia',                       'Medicina Preventiva e Social'),
    ('Oncologia Clínica',                 'oncologia clinica',                   'Clínica Médica'),
    ('Farmacologia Oncológica',           'farmacologia oncologica',             'Clínica Médica'),
    ('Pediatria Geral',                   'pediatria geral',                     'Pediatria'),
    ('Terapia Intensiva',                 'terapia intensiva',                   'Medicina Intensiva'),
    ('CTI',                               'cti',                                 'Medicina Intensiva'),
    ('UTI',                               'uti',                                 'Medicina Intensiva')
)
INSERT INTO public.curriculum_aliases (alias, normalized_alias, specialty_id, source)
SELECT s.alias, s.normalized_alias, sp.id, 'seed_v1'
FROM seeds s
JOIN public.curriculum_specialties sp ON sp.nome = s.specialty_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.curriculum_aliases a
  WHERE a.normalized_alias = s.normalized_alias AND a.active = true
);