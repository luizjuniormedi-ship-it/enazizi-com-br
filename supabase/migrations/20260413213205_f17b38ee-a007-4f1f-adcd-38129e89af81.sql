
-- Rankings need to be visible to all authenticated users for the leaderboard
-- Drop the restrictive policy and create a broader one
DROP POLICY IF EXISTS "Users read own ranking snapshots" ON public.ranking_snapshots;
CREATE POLICY "Authenticated read rankings" ON public.ranking_snapshots
  FOR SELECT TO authenticated USING (true);

-- Gamification also needs to be visible for leaderboard
DROP POLICY IF EXISTS "Users read own gamification" ON public.user_gamification;
CREATE POLICY "Authenticated read gamification" ON public.user_gamification
  FOR SELECT TO authenticated USING (true);
