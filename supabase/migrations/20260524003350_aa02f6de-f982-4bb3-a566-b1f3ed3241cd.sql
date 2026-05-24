-- Enable RLS (already enabled but just in case)
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if needed or just add/update
DROP POLICY IF EXISTS "Users can manage their own pedagogical events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Users can view their own pedagogical events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Users can insert their own pedagogical events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Admins can view all pedagogical events" ON public.pedagogical_events;

-- Allow authenticated users to manage their own events
CREATE POLICY "Users can manage their own pedagogical events"
ON public.pedagogical_events
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all pedagogical events"
ON public.pedagogical_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Explicitly allow inserts for telemetria safety (redundant with ALL but good for clarity)
CREATE POLICY "Users can insert their own pedagogical events"
ON public.pedagogical_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix public RPCs for login page
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_testimonials() TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_testimonials() TO authenticated;
