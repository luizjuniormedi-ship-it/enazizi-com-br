
-- 1. RANKING_SNAPSHOTS
DROP POLICY IF EXISTS "Authenticated can read all ranking snapshots for ranking" ON public.ranking_snapshots;
DROP POLICY IF EXISTS "Authenticated read rankings" ON public.ranking_snapshots;
DROP POLICY IF EXISTS "Service role manages ranking snapshots" ON public.ranking_snapshots;

CREATE POLICY "Service role manages ranking snapshots"
ON public.ranking_snapshots
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_ranking_leaderboard(_limit int DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  performance_rank int,
  performance_rank_delta int,
  evolution_rank int,
  consistency_rank int,
  practical_rank int,
  performance_score numeric,
  evolution_score numeric,
  consistency_score numeric,
  practical_score numeric,
  percentile int,
  snapshot_date date,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rs.user_id,
    rs.performance_rank,
    rs.performance_rank_delta,
    rs.evolution_rank,
    rs.consistency_rank,
    rs.practical_rank,
    rs.performance_score,
    rs.evolution_score,
    rs.consistency_score,
    rs.practical_score,
    rs.percentile,
    rs.snapshot_date,
    COALESCE(p.display_name, 'Aluno') AS display_name,
    p.avatar_url
  FROM public.ranking_snapshots rs
  LEFT JOIN public.profiles p ON p.user_id = rs.user_id
  WHERE rs.snapshot_date = (SELECT MAX(snapshot_date) FROM public.ranking_snapshots)
  ORDER BY rs.performance_rank ASC NULLS LAST
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_leaderboard(int) TO authenticated;

-- 2. INSTITUTION_MEMBERS
DROP POLICY IF EXISTS "Staff can read institution members" ON public.institution_members;

CREATE POLICY "Staff can read institution members"
ON public.institution_members
FOR SELECT
TO authenticated
USING (
  institution_id = user_institution_id(auth.uid())
  AND user_is_institution_staff(auth.uid())
);

CREATE POLICY "Members can read own institution membership"
ON public.institution_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. PROFILES (função segura para colegas / staff)
CREATE OR REPLACE FUNCTION public.get_classmate_profile(_target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  faculdade text,
  user_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.faculdade,
    p.user_type
  FROM public.profiles p
  WHERE p.user_id = _target_user_id
    AND (
      p.user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR users_share_institution(auth.uid(), _target_user_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_classmate_profile(uuid) TO authenticated;
