-- Enable RLS on tables where it was disabled
ALTER TABLE public.archived_simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alos_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_questions_bank ENABLE ROW LEVEL SECURITY;

-- Add default "deny all" or "system only" policies if they don't have any
-- For these specific tables, they seem to be internal/archived, so only service role should access them by default.
-- Since service role bypasses RLS, we don't strictly need a policy for it, but enabling RLS without policies
-- effectively blocks all public access via PostgREST.

-- Fix Security Definer views identified by linter (example for common views, but I need to be careful)
-- Actually, it's safer to just enable RLS on the missing tables first.

-- Also add policies for tables that have RLS enabled but no policies, to satisfy the linter.
-- These tables seem to be for telemetry and logs, so we'll allow insert for authenticated users if needed, 
-- but usually they are populated by Edge Functions (service role).
-- For now, enabling RLS on the disabled ones is the most critical fix.
