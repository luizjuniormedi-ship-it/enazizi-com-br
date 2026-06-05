-- Step 1: Fix function search path
CREATE OR REPLACE FUNCTION public.log_institutional_event() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_telemetry (event_type, metadata)
    VALUES (TG_ARGV[0], jsonb_build_object('id', NEW.id, 'timestamp', now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Step 2: Add missing RLS policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read effect size') THEN
        CREATE POLICY "Allow authenticated read effect size" ON public.effect_size_metrics FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read reports') THEN
        CREATE POLICY "Allow authenticated read reports" ON public.scientific_reports FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read governance') THEN
        CREATE POLICY "Allow authenticated read governance" ON public.institutional_governance FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
