
-- Add quality gate fields to medical_image_assets
ALTER TABLE public.medical_image_assets 
  ADD COLUMN IF NOT EXISTS quality_gate_passed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create audit log table
CREATE TABLE IF NOT EXISTS public.asset_quality_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.medical_image_assets(id) ON DELETE CASCADE NOT NULL,
  image_type text,
  status text NOT NULL, -- approved, rejected, pending_review
  rejection_reason text,
  visual_quality_score numeric,
  clinical_match_score numeric,
  gate_source text, -- 'ai_validation', 'url_filter', 'manual', 'retroactive_audit', 'pipeline'
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_quality_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit logs"
  ON public.asset_quality_audit_logs FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_quality_audit_asset ON public.asset_quality_audit_logs(asset_id);
CREATE INDEX idx_quality_audit_status ON public.asset_quality_audit_logs(status);

-- Backfill: approve existing valid assets
UPDATE public.medical_image_assets
SET quality_gate_passed = true
WHERE is_active = true
  AND ai_validated = true
  AND integrity_status = 'ok'
  AND validation_level IN ('gold', 'silver')
  AND clinical_confidence >= 0.8
  AND image_url IS NOT NULL
  AND image_url != '';

-- Mark rest as not passed
UPDATE public.medical_image_assets
SET quality_gate_passed = false
WHERE quality_gate_passed IS NULL OR quality_gate_passed != true;
