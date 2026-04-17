
DROP POLICY IF EXISTS "Invited students can read video rooms" ON public.video_rooms;

CREATE POLICY "Eligible students can read active video rooms"
ON public.video_rooms FOR SELECT TO authenticated
USING (
  status = 'active'
  AND (
    -- aluno explicitamente convidado
    invited_students ? auth.uid()::text
    -- ou sem lista de convidados, mas sala aberta para faculdade/período do aluno
    OR (
      (invited_students IS NULL OR jsonb_typeof(invited_students) <> 'array' OR jsonb_array_length(invited_students) = 0)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND (video_rooms.faculdade_filter IS NULL OR video_rooms.faculdade_filter = p.faculdade)
          AND (video_rooms.periodo_filter IS NULL OR video_rooms.periodo_filter = p.periodo)
      )
    )
  )
);
