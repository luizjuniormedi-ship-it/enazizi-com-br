-- ============================================================
-- Sprint Intel-1 — FASE 1
-- Tabela: public.enamed_intelligence_index (v0.3 FINAL)
-- ============================================================

CREATE TABLE public.enamed_intelligence_index (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chave semântica
  specialty_id          uuid NOT NULL REFERENCES public.curriculum_specialties(id),
  subspecialty_id       uuid NULL,  -- sem FK proposital (validado pela edge)
  exam_key              text NOT NULL,

  -- Métricas brutas
  question_count        int  NOT NULL DEFAULT 0,
  historical_frequency  numeric(5,4) NOT NULL DEFAULT 0,
  student_error_rate    numeric(5,4) NULL,
  fsrs_risk             numeric(5,4) NULL,

  -- Score final
  priority_score        numeric(6,2) NOT NULL DEFAULT 0,
  confidence_level      text NOT NULL DEFAULT 'experimental'
                        CHECK (confidence_level IN ('experimental','low','medium','high')),

  -- Governança
  sample_size           int  NOT NULL DEFAULT 0,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  computed_by           text NOT NULL DEFAULT 'compute-intelligence-index',
  computation_version   text NOT NULL DEFAULT 'v1.0',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT eii_unique_key UNIQUE (specialty_id, subspecialty_id, exam_key)
);

-- Índice parcial: garante unicidade real quando subspecialty_id IS NULL
-- (porque UNIQUE padrão não trata NULLs como iguais no Postgres)
CREATE UNIQUE INDEX idx_eii_unique_specialty_null_sub
  ON public.enamed_intelligence_index (specialty_id, exam_key)
  WHERE subspecialty_id IS NULL;

-- Índices de consulta
CREATE INDEX idx_eii_exam_priority ON public.enamed_intelligence_index (exam_key, priority_score DESC);
CREATE INDEX idx_eii_specialty     ON public.enamed_intelligence_index (specialty_id);
CREATE INDEX idx_eii_confidence    ON public.enamed_intelligence_index (confidence_level);
CREATE INDEX idx_eii_computed_at   ON public.enamed_intelligence_index (computed_at DESC);

-- GRANTs (RLS filtra leitura por role)
GRANT SELECT ON public.enamed_intelligence_index TO authenticated;
GRANT ALL    ON public.enamed_intelligence_index TO service_role;
-- anon: sem acesso (não concedido)

-- RLS
ALTER TABLE public.enamed_intelligence_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eii_read_admin_professor"
  ON public.enamed_intelligence_index
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'professor')
  );

CREATE POLICY "eii_write_service_only"
  ON public.enamed_intelligence_index
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at (reusa função padrão do projeto)
CREATE TRIGGER trg_eii_updated_at
  BEFORE UPDATE ON public.enamed_intelligence_index
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
