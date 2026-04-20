
-- study_materials: campos de auditoria
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS reviewed_by_human boolean NOT NULL DEFAULT false;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS generation_method text;

-- flashcards: explanation + auditoria + source
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS reviewed_by_human boolean NOT NULL DEFAULT false;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS content_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS generation_method text;

-- índices úteis para o painel
CREATE INDEX IF NOT EXISTS idx_study_materials_source ON public.study_materials(source) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_study_materials_reviewed ON public.study_materials(reviewed_by_human) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_flashcards_source ON public.flashcards(source) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_flashcards_reviewed ON public.flashcards(reviewed_by_human) WHERE is_global = true;
