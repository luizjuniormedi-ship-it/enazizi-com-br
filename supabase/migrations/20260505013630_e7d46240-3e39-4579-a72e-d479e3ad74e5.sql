-- 1. Remover políticas antigas da tabela uploads para recriar com suporte a tenant
DROP POLICY IF EXISTS "Users can read own or global uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.uploads;

-- 2. Novas políticas com isolamento multi-tenant

-- SELECT: Alunos veem globais ou da própria organização. Admin/Prof veem tudo da org.
CREATE POLICY "Users can read relevant uploads"
  ON public.uploads FOR SELECT
  USING (
    is_global = true 
    OR (
      organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR user_id = auth.uid()
  );

-- INSERT: Apenas donos, validando organization_id
CREATE POLICY "Users can insert own uploads"
  ON public.uploads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IS NULL 
      OR organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- UPDATE: Apenas donos ou Admin/Professor da mesma organização
CREATE POLICY "Users can update relevant uploads"
  ON public.uploads FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'professor'))
      AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- DELETE: Apenas donos ou Admin da mesma organização
CREATE POLICY "Users can delete relevant uploads"
  ON public.uploads FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
      AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- 3. Garantir que a tabela rag_documents também tenha organização correta
-- (Já criado na migração anterior, mas reforçando integridade)
ALTER TABLE public.rag_documents ALTER COLUMN organization_id SET NOT NULL;
