
-- 1. Add image_type and question_id to medical_image_attempts for visual weakness tracking
ALTER TABLE public.medical_image_attempts
  ADD COLUMN IF NOT EXISTS image_type text,
  ADD COLUMN IF NOT EXISTS question_id uuid REFERENCES public.medical_image_questions(id);

-- Index for per-user per-type aggregation
CREATE INDEX IF NOT EXISTS idx_mia_user_image_type ON public.medical_image_attempts(user_id, image_type);

-- 2. Visual skill snapshots table
CREATE TABLE IF NOT EXISTS public.visual_skill_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_type text NOT NULL,
  attempts_count integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  accuracy numeric NOT NULL DEFAULT 0,
  avg_time_seconds numeric DEFAULT NULL,
  score integer NOT NULL DEFAULT 0,
  trend text NOT NULL DEFAULT 'stable',
  confidence_level text NOT NULL DEFAULT 'low',
  recent_window_accuracy numeric DEFAULT NULL,
  strongest_area boolean NOT NULL DEFAULT false,
  weakest_area boolean NOT NULL DEFAULT false,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, image_type)
);

ALTER TABLE public.visual_skill_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own visual skills"
  ON public.visual_skill_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own visual skills"
  ON public.visual_skill_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own visual skills"
  ON public.visual_skill_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_visual_skill_updated_at
  BEFORE UPDATE ON public.visual_skill_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Asset validation results table (AI validation audit trail)
CREATE TABLE IF NOT EXISTS public.asset_validation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.medical_image_assets(id) ON DELETE CASCADE,
  is_medical_image boolean NOT NULL DEFAULT false,
  detected_image_type text,
  clinical_match_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 0,
  validation_status text NOT NULL DEFAULT 'pending',
  validation_reason text,
  model_used text,
  validated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view validations"
  ON public.asset_validation_results FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role inserts validations"
  ON public.asset_validation_results FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_avr_asset ON public.asset_validation_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_avr_status ON public.asset_validation_results(validation_status);

-- 4. Backfill image_type on existing attempts from joined asset data
UPDATE public.medical_image_attempts ma
SET image_type = a.image_type::text
FROM public.medical_image_assets a
WHERE ma.image_id = a.id AND ma.image_type IS NULL;
