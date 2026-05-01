-- Phase 2: Quality Governance
CREATE TABLE public.cme_quality_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    quality_score FLOAT DEFAULT 0,
    fatigue_score FLOAT DEFAULT 0,
    drift_score FLOAT DEFAULT 0,
    continuity_score FLOAT DEFAULT 0,
    narrative_score FLOAT DEFAULT 0,
    pacing_score FLOAT DEFAULT 0,
    reviewer_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 3: Session Variants
CREATE TABLE public.cme_session_variants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    variant_type TEXT NOT NULL, -- 'Full Lecture', 'Feynman', 'Exam Sprint', etc.
    pacing_profile JSONB DEFAULT '{}',
    voice_profile TEXT,
    target_duration INTEGER, -- seconds
    cognitive_density FLOAT,
    retention_projection FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 4: Render Lineage
CREATE TABLE public.cme_render_lineage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    render_job_id UUID, -- External ID from render engine
    variant_id UUID REFERENCES public.cme_session_variants(id),
    parent_render_id UUID,
    output_url TEXT,
    scene_graph_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 5: Advanced Scene Graph Components
CREATE TABLE public.cme_scene_transitions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    from_node_id UUID,
    to_node_id UUID,
    transition_type TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 500,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.cme_overlay_clusters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    block_id UUID REFERENCES public.cme_lesson_blocks(id) ON DELETE CASCADE,
    cluster_data JSONB NOT NULL, -- hotspots, adaptive highlights
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.cme_attention_maps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lineage_id UUID REFERENCES public.cme_render_lineage(id),
    heatmap_data JSONB NOT NULL,
    cognitive_load_curve JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_quality_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_session_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_overlay_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_attention_maps ENABLE ROW LEVEL SECURITY;

-- Create Policies (Admin/Teacher only for most)
CREATE POLICY "Admins can manage quality reviews" ON public.cme_quality_reviews FOR ALL USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'teacher');
CREATE POLICY "Admins can manage variants" ON public.cme_session_variants FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admins can manage lineage" ON public.cme_render_lineage FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admins can manage scene transitions" ON public.cme_scene_transitions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admins can manage overlay clusters" ON public.cme_overlay_clusters FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admins can manage attention maps" ON public.cme_attention_maps FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Add variant_id to cme_lesson_blocks for tracking which variant a block belongs to if needed
ALTER TABLE public.cme_lesson_blocks ADD COLUMN variant_id UUID REFERENCES public.cme_session_variants(id);
