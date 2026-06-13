
DROP POLICY IF EXISTS "Admins view all outcomes" ON public.official_exam_outcomes;
DROP POLICY IF EXISTS "Admins update all outcomes" ON public.official_exam_outcomes;

CREATE POLICY "Admins view all outcomes"
  ON public.official_exam_outcomes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all outcomes"
  ON public.official_exam_outcomes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all snapshots" ON public.alpha_cohort_snapshots;
CREATE POLICY "Admins view all snapshots"
  ON public.alpha_cohort_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
