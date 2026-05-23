-- Fix pedagogical_events RLS
DROP POLICY IF EXISTS "Users can view their own events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Users can insert their own pedagogical events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Users can update own pedagogical events" ON public.pedagogical_events;
DROP POLICY IF EXISTS "Admins view all pedagogical events" ON public.pedagogical_events;

ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pedagogical events"
ON public.pedagogical_events
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pedagogical events"
ON public.pedagogical_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ensure AI Circuit Breaker and Inflight tables are solid
ALTER TABLE public.ai_provider_circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inflight_requests ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) to manage these, but also authenticated for transparency if needed
CREATE POLICY "Service role manages circuits"
ON public.ai_provider_circuits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manages inflight"
ON public.ai_inflight_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Explicitly allow authenticated to SELECT if they need to check status
CREATE POLICY "Users can view provider circuits"
ON public.ai_provider_circuits
FOR SELECT
TO authenticated
USING (true);

-- Fix for pedagogical_events grants
GRANT ALL ON TABLE public.pedagogical_events TO authenticated;
GRANT ALL ON TABLE public.pedagogical_events TO service_role;
