-- Tabela de memória pedagógica do Tutor IA
CREATE TABLE public.tutor_knowledge_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id uuid NULL,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'user')),
  
  question_original text NOT NULL,
  question_normalized text NOT NULL,
  
  topic text NULL,
  subtopic text NULL,
  specialty text NULL,
  
  intent text NULL,
  difficulty_level text NULL,
  
  answer_summary text NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  block_types text[] NULL,
  
  quality_score numeric NOT NULL DEFAULT 0,
  reuse_count integer NOT NULL DEFAULT 0,
  
  source text NOT NULL DEFAULT 'tutor_ai',
  model_used text NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  
  -- Constraint: scope='user' requires user_id
  CONSTRAINT tutor_memory_user_scope_check CHECK (
    (scope = 'global' AND user_id IS NULL) OR
    (scope = 'user' AND user_id IS NOT NULL)
  )
);

-- Índices
CREATE INDEX idx_tutor_memory_user ON public.tutor_knowledge_memory(user_id);
CREATE INDEX idx_tutor_memory_scope ON public.tutor_knowledge_memory(scope);
CREATE INDEX idx_tutor_memory_topic ON public.tutor_knowledge_memory(topic);
CREATE INDEX idx_tutor_memory_subtopic ON public.tutor_knowledge_memory(subtopic);
CREATE INDEX idx_tutor_memory_question_normalized ON public.tutor_knowledge_memory(question_normalized);
CREATE INDEX idx_tutor_memory_blocks_gin ON public.tutor_knowledge_memory USING gin(blocks);
CREATE INDEX idx_tutor_memory_block_types_gin ON public.tutor_knowledge_memory USING gin(block_types);
CREATE INDEX idx_tutor_memory_quality_reuse ON public.tutor_knowledge_memory(quality_score DESC, reuse_count DESC);

-- Trigger updated_at
CREATE TRIGGER trg_tutor_memory_updated_at
BEFORE UPDATE ON public.tutor_knowledge_memory
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.tutor_knowledge_memory ENABLE ROW LEVEL SECURITY;

-- SELECT: globais por todos autenticados; pessoais apenas do dono
CREATE POLICY "Anyone authenticated can read global memory"
ON public.tutor_knowledge_memory
FOR SELECT
TO authenticated
USING (scope = 'global');

CREATE POLICY "Users can read their own memory"
ON public.tutor_knowledge_memory
FOR SELECT
TO authenticated
USING (scope = 'user' AND user_id = auth.uid());

CREATE POLICY "Admins can read all memory"
ON public.tutor_knowledge_memory
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT: usuários inserem apenas próprias memórias; globais via admin/service role
CREATE POLICY "Users can insert their own memory"
ON public.tutor_knowledge_memory
FOR INSERT
TO authenticated
WITH CHECK (scope = 'user' AND user_id = auth.uid());

CREATE POLICY "Admins can insert global memory"
ON public.tutor_knowledge_memory
FOR INSERT
TO authenticated
WITH CHECK (
  scope = 'global' 
  AND user_id IS NULL 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- UPDATE: usuário atualiza própria memória; qualquer autenticado pode incrementar quality/reuse em globais
CREATE POLICY "Users can update their own memory"
ON public.tutor_knowledge_memory
FOR UPDATE
TO authenticated
USING (scope = 'user' AND user_id = auth.uid())
WITH CHECK (scope = 'user' AND user_id = auth.uid());

CREATE POLICY "Admins can update any memory"
ON public.tutor_knowledge_memory
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- DELETE: apenas admins ou o dono da memória pessoal
CREATE POLICY "Users can delete their own memory"
ON public.tutor_knowledge_memory
FOR DELETE
TO authenticated
USING (scope = 'user' AND user_id = auth.uid());

CREATE POLICY "Admins can delete any memory"
ON public.tutor_knowledge_memory
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Função RPC para incrementar reuse_count + last_used_at de forma segura
CREATE OR REPLACE FUNCTION public.tutor_memory_increment_reuse(_memory_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tutor_knowledge_memory
  SET reuse_count = reuse_count + 1,
      last_used_at = now()
  WHERE id = _memory_id;
END;
$$;

-- Função RPC para ajustar quality_score (delta positivo ou negativo)
CREATE OR REPLACE FUNCTION public.tutor_memory_adjust_quality(_memory_id uuid, _delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tutor_knowledge_memory
  SET quality_score = GREATEST(0, LEAST(100, quality_score + _delta))
  WHERE id = _memory_id;
END;
$$;

COMMENT ON TABLE public.tutor_knowledge_memory IS 'Memória pedagógica reutilizável do Tutor IA. Armazena blocos cognitivos por pergunta normalizada para reduzir custo de IA e manter consistência.';