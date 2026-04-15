
-- Import priority configuration per image type
CREATE TABLE public.import_priority_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_type text NOT NULL UNIQUE,
  diagnosis_rankings jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty_targets jsonb NOT NULL DEFAULT '{"easy": 0.20, "medium": 0.40, "hard": 0.40}'::jsonb,
  min_assets_per_diagnosis int NOT NULL DEFAULT 3,
  max_assets_per_diagnosis int NOT NULL DEFAULT 15,
  priority_mode text NOT NULL DEFAULT 'hybrid',
  weight_exam_relevance numeric NOT NULL DEFAULT 0.40,
  weight_student_weakness numeric NOT NULL DEFAULT 0.35,
  weight_inventory_gap numeric NOT NULL DEFAULT 0.25,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_priority_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read priority config"
  ON public.import_priority_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage priority config"
  ON public.import_priority_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_import_priority_config
  BEFORE UPDATE ON public.import_priority_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Content gap reports
CREATE TABLE public.content_gap_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_type text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_diagnoses jsonb DEFAULT '[]'::jsonb,
  saturated_diagnoses jsonb DEFAULT '[]'::jsonb,
  difficulty_gaps jsonb DEFAULT '{}'::jsonb,
  weakness_influenced jsonb DEFAULT '[]'::jsonb,
  next_batch_recommendation jsonb DEFAULT '[]'::jsonb,
  priority_mode text NOT NULL DEFAULT 'hybrid',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_gap_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read gap reports"
  ON public.content_gap_reports FOR SELECT TO authenticated USING (true);

-- DB function to compute content gaps per image_type
CREATE OR REPLACE FUNCTION public.compute_content_gaps(p_image_type text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'image_type', p_image_type,
    'total_assets', (SELECT COUNT(*) FROM medical_image_assets WHERE image_type = p_image_type AND is_active = true),
    'total_questions', (SELECT COUNT(*) FROM medical_image_questions q JOIN medical_image_assets a ON q.asset_id = a.id WHERE a.image_type = p_image_type AND a.is_active = true AND q.status = 'published'),
    'assets_without_questions', (SELECT COUNT(*) FROM medical_image_assets WHERE image_type = p_image_type AND is_active = true AND question_generated = false),
    'diagnosis_distribution', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('diagnosis', diagnosis, 'count', cnt, 'with_questions', wq)), '[]'::jsonb)
      FROM (
        SELECT a.diagnosis, COUNT(*) as cnt, COUNT(*) FILTER (WHERE a.question_generated = true) as wq
        FROM medical_image_assets a WHERE a.image_type = p_image_type AND a.is_active = true
        GROUP BY a.diagnosis ORDER BY cnt DESC
      ) sub
    ),
    'difficulty_distribution', jsonb_build_object(
      'easy', (SELECT COUNT(*) FROM medical_image_assets WHERE image_type = p_image_type AND is_active = true AND difficulty = 'easy'),
      'medium', (SELECT COUNT(*) FROM medical_image_assets WHERE image_type = p_image_type AND is_active = true AND difficulty = 'medium'),
      'hard', (SELECT COUNT(*) FROM medical_image_assets WHERE image_type = p_image_type AND is_active = true AND difficulty = 'hard')
    ),
    'computed_at', now()
  ) INTO result;
  RETURN result;
END;
$$;

-- Seed priority config for xray and ecg
INSERT INTO public.import_priority_config (image_type, diagnosis_rankings, difficulty_targets) VALUES
('xray', '[
  {"diagnosis": "Pneumonia", "rank": 1, "exam_weight": 10},
  {"diagnosis": "Derrame pleural", "rank": 2, "exam_weight": 9},
  {"diagnosis": "Pneumotórax", "rank": 3, "exam_weight": 9},
  {"diagnosis": "Atelectasia", "rank": 4, "exam_weight": 8},
  {"diagnosis": "Cardiomegalia", "rank": 5, "exam_weight": 8},
  {"diagnosis": "Edema pulmonar", "rank": 6, "exam_weight": 8},
  {"diagnosis": "Consolidação", "rank": 7, "exam_weight": 7},
  {"diagnosis": "Massa/nódulo pulmonar", "rank": 8, "exam_weight": 7},
  {"diagnosis": "DPOC/enfisema", "rank": 9, "exam_weight": 6},
  {"diagnosis": "Fibrose pulmonar", "rank": 10, "exam_weight": 6},
  {"diagnosis": "Tuberculose pulmonar", "rank": 11, "exam_weight": 7},
  {"diagnosis": "Hemotórax", "rank": 12, "exam_weight": 5},
  {"diagnosis": "Mediastino alargado", "rank": 13, "exam_weight": 5},
  {"diagnosis": "Pneumomediastino", "rank": 14, "exam_weight": 4}
]'::jsonb, '{"easy": 0.25, "medium": 0.40, "hard": 0.35}'::jsonb),
('ecg', '[
  {"diagnosis": "Ritmo sinusal normal", "rank": 1, "exam_weight": 10},
  {"diagnosis": "Fibrilação atrial", "rank": 2, "exam_weight": 10},
  {"diagnosis": "Flutter atrial", "rank": 3, "exam_weight": 9},
  {"diagnosis": "Bloqueio de ramo direito", "rank": 4, "exam_weight": 8},
  {"diagnosis": "Bloqueio de ramo esquerdo", "rank": 5, "exam_weight": 8},
  {"diagnosis": "Bloqueio AV", "rank": 6, "exam_weight": 8},
  {"diagnosis": "Taquicardia supraventricular", "rank": 7, "exam_weight": 7},
  {"diagnosis": "Bradicardia sinusal", "rank": 8, "exam_weight": 7},
  {"diagnosis": "Isquemia miocárdica", "rank": 9, "exam_weight": 9},
  {"diagnosis": "Hipertrofia ventricular esquerda", "rank": 10, "exam_weight": 7},
  {"diagnosis": "Hipercalemia", "rank": 11, "exam_weight": 6},
  {"diagnosis": "Síndrome de Wolff-Parkinson-White", "rank": 12, "exam_weight": 5},
  {"diagnosis": "Taquicardia ventricular", "rank": 13, "exam_weight": 7},
  {"diagnosis": "Infarto agudo do miocárdio", "rank": 14, "exam_weight": 9}
]'::jsonb, '{"easy": 0.30, "medium": 0.40, "hard": 0.30}'::jsonb),
('ct', '[
  {"diagnosis": "AVC isquêmico", "rank": 1, "exam_weight": 9},
  {"diagnosis": "AVC hemorrágico", "rank": 2, "exam_weight": 9},
  {"diagnosis": "Hematoma subdural", "rank": 3, "exam_weight": 8},
  {"diagnosis": "Dissecção de aorta", "rank": 4, "exam_weight": 8},
  {"diagnosis": "Obstrução intestinal", "rank": 5, "exam_weight": 7},
  {"diagnosis": "Pancreatite aguda", "rank": 6, "exam_weight": 7},
  {"diagnosis": "Apendicite", "rank": 7, "exam_weight": 7},
  {"diagnosis": "Embolia pulmonar", "rank": 8, "exam_weight": 8}
]'::jsonb, '{"easy": 0.20, "medium": 0.40, "hard": 0.40}'::jsonb),
('dermatology', '[
  {"diagnosis": "Melanoma", "rank": 1, "exam_weight": 10},
  {"diagnosis": "Carcinoma basocelular", "rank": 2, "exam_weight": 9},
  {"diagnosis": "Psoríase", "rank": 3, "exam_weight": 8},
  {"diagnosis": "Dermatite atópica", "rank": 4, "exam_weight": 7},
  {"diagnosis": "Herpes zoster", "rank": 5, "exam_weight": 7}
]'::jsonb, '{"easy": 0.25, "medium": 0.40, "hard": 0.35}'::jsonb);
