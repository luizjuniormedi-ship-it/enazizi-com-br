-- 1. SECURITY DEFINER Functions Hardening
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        -- Set search_path to prevent hijacking
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, auth', func_record.schema, func_record.function_name, func_record.args);
        
        -- Revoke default PUBLIC execution rights
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', func_record.schema, func_record.function_name, func_record.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', func_record.schema, func_record.function_name, func_record.args);
        
        -- Grant explicitly to authenticated and service_role
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.schema, func_record.function_name, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.schema, func_record.function_name, func_record.args);
    END LOOP;
END $$;

-- 2. Fix asset_validation_results RLS (Restricting Always True policy)
DROP POLICY IF EXISTS "Authenticated users can view validations" ON asset_validation_results;
CREATE POLICY "Admins and professors can view validations" 
ON asset_validation_results 
FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'professor'::app_role));

-- 3. Fix drive_ingestion_log policy (Remove user_metadata dependency)
DROP POLICY IF EXISTS "Admins can manage drive ingestion logs" ON drive_ingestion_log;
CREATE POLICY "Admins can manage drive ingestion logs" 
ON drive_ingestion_log 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::app_role) OR (auth.jwt() ->> 'role') = 'service_role')
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (auth.jwt() ->> 'role') = 'service_role');

-- 4. Storage Security Hardening
-- FIX CRITICAL VULNERABILITY: Service Role Access was accidentally public
DROP POLICY IF EXISTS "Service Role Access" ON storage.objects;
CREATE POLICY "Service Role Access" 
ON storage.objects 
FOR ALL 
TO service_role 
USING (bucket_id = 'question-images'::text)
WITH CHECK (bucket_id = 'question-images'::text);

-- Hardening avatar uploads to authenticated only
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 5. Views Hardening (Enforcing Security Invoker)
DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('ALTER VIEW %I SET (security_invoker = true)', view_record.table_name);
    END LOOP;
END $$;

-- 6. Move Extensions to Dedicated Schema
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
DECLARE
    ext_record RECORD;
BEGIN
    FOR ext_record IN 
        SELECT extname 
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public' AND extname IN ('vector', 'unaccent', 'pg_trgm')
    LOOP
        EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_record.extname);
    END LOOP;
END $$;

-- 7. Add policies for tables with RLS enabled but no policies
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE rowsecurity = true AND schemaname = 'public' AND NOT EXISTS (
            SELECT 1 FROM pg_policies p 
            WHERE p.schemaname = pg_tables.schemaname AND p.tablename = pg_tables.tablename
        )
    LOOP
        EXECUTE format('CREATE POLICY "Admins can manage %I" ON %I.%I FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role))', 
            table_record.tablename, table_record.schemaname, table_record.tablename);
    END LOOP;
END $$;
