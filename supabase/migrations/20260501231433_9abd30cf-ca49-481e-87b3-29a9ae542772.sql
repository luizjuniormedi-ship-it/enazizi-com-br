-- 1. Ensure cme_scene_graphs schema
DO $$ 
BEGIN 
    -- Ensure columns exist and have correct defaults for cme_scene_graphs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'status') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN status text DEFAULT 'draft';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'title') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN title text;
    END IF;

    -- Update defaults
    ALTER TABLE public.cme_scene_graphs ALTER COLUMN graph_payload SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.cme_scene_graphs ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
    ALTER TABLE public.cme_scene_graphs ALTER COLUMN status SET DEFAULT 'draft';
END $$;

-- Add indices for cme_scene_graphs
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_user_id ON public.cme_scene_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_project_id ON public.cme_scene_graphs(video_project_id);

-- 2. Ensure cme_scene_graph_nodes schema
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graph_nodes' AND column_name = 'sequence_order') THEN
        ALTER TABLE public.cme_scene_graph_nodes ADD COLUMN sequence_order integer DEFAULT 0;
    END IF;
    
    -- Update defaults
    ALTER TABLE public.cme_scene_graph_nodes ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
END $$;

-- Add indices for cme_scene_graph_nodes
CREATE INDEX IF NOT EXISTS idx_scene_nodes_graph_id ON public.cme_scene_graph_nodes(scene_graph_id);
CREATE INDEX IF NOT EXISTS idx_scene_nodes_user_id ON public.cme_scene_graph_nodes(user_id);

-- 3. Hardened RLS Policies
ALTER TABLE public.cme_scene_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_graph_nodes ENABLE ROW LEVEL SECURITY;

-- Drop existing to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users insert own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users select own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users update own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Allow authenticated manage scene graphs" ON public.cme_scene_graphs;

DROP POLICY IF EXISTS "Users can manage their own nodes" ON public.cme_scene_graph_nodes;
DROP POLICY IF EXISTS "Allow authenticated manage scene graph nodes" ON public.cme_scene_graph_nodes;
DROP POLICY IF EXISTS "Users can access their own nodes" ON public.cme_scene_graph_nodes;

-- New strict policies for cme_scene_graphs
CREATE POLICY "cme_scene_graphs_insert_policy" ON public.cme_scene_graphs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cme_scene_graphs_select_policy" ON public.cme_scene_graphs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "cme_scene_graphs_update_policy" ON public.cme_scene_graphs
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cme_scene_graphs_delete_policy" ON public.cme_scene_graphs
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- New strict policies for cme_scene_graph_nodes
CREATE POLICY "cme_scene_graph_nodes_insert_policy" ON public.cme_scene_graph_nodes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cme_scene_graph_nodes_select_policy" ON public.cme_scene_graph_nodes
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "cme_scene_graph_nodes_update_policy" ON public.cme_scene_graph_nodes
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cme_scene_graph_nodes_delete_policy" ON public.cme_scene_graph_nodes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admin & Service Role access (optional but recommended for observability)
CREATE POLICY "admin_all_scene_graphs" ON public.cme_scene_graphs
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    );

CREATE POLICY "admin_all_scene_nodes" ON public.cme_scene_graph_nodes
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    );

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
