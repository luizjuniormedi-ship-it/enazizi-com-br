-- 1. study_materials (híbrida)
CREATE TABLE IF NOT EXISTS public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  material_type text NOT NULL DEFAULT 'resumo' 
    CHECK (material_type IN ('resumo','aula','revisao','guideline','anotacao','mapa_mental','outro')),
  difficulty_level int CHECK (difficulty_level BETWEEN 1 AND 5),
  source text,
  specialty_id uuid REFERENCES public.curriculum_specialties(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES public.curriculum_subtopics(id) ON DELETE SET NULL,
  microtopic_id uuid REFERENCES public.curriculum_microtopics(id) ON DELETE SET NULL,
  is_global boolean NOT NULL DEFAULT false,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT study_materials_owner_check CHECK (
    (is_global = true AND user_id IS NULL) OR 
    (is_global = false AND user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_study_materials_subtopic ON public.study_materials(subtopic_id) WHERE subtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_materials_microtopic ON public.study_materials(microtopic_id) WHERE microtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_materials_topic ON public.study_materials(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_materials_specialty ON public.study_materials(specialty_id) WHERE specialty_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_materials_user ON public.study_materials(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_materials_global_active ON public.study_materials(is_global, ativo) WHERE ativo = true;

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_materials_select_global_or_own"
  ON public.study_materials FOR SELECT
  USING (
    is_global = true 
    OR user_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "study_materials_insert_own_or_admin_global"
  ON public.study_materials FOR INSERT
  WITH CHECK (
    (is_global = false AND user_id = auth.uid())
    OR (is_global = true AND has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "study_materials_update_own_or_admin"
  ON public.study_materials FOR UPDATE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "study_materials_delete_own_or_admin"
  ON public.study_materials FOR DELETE
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_study_materials_updated_at
  BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Estender flashcards com vínculos curriculares
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.curriculum_subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS microtopic_id uuid REFERENCES public.curriculum_microtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialty_id uuid REFERENCES public.curriculum_specialties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS difficulty int CHECK (difficulty BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_flashcards_subtopic ON public.flashcards(subtopic_id) WHERE subtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flashcards_microtopic ON public.flashcards(microtopic_id) WHERE microtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flashcards_specialty ON public.flashcards(specialty_id) WHERE specialty_id IS NOT NULL;

-- 3. Índice extra em microtopics para joins da auditoria
CREATE INDEX IF NOT EXISTS idx_curriculum_microtopics_subtopic_active 
  ON public.curriculum_microtopics(subtopic_id, ativo) WHERE ativo = true;

COMMENT ON TABLE public.study_materials IS 'Materiais de estudo (resumos, guidelines, aulas) ligados ao currículo. Híbrido: globais (admin) + pessoais (aluno).';
COMMENT ON COLUMN public.flashcards.subtopic_id IS 'Vínculo curricular Fase 1.2 — usado pela auditoria de cobertura.';