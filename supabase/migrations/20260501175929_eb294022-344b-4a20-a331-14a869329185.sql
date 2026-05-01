-- FASE 1: Semantic Planner Engine
ALTER TABLE public.cme_semantic_plans 
ADD COLUMN IF NOT EXISTS render_job_id UUID,
ADD COLUMN IF NOT EXISTS specialty TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS subtopic TEXT,
ADD COLUMN IF NOT EXISTS concept_map JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS clinical_reasoning_flow JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS pharmacology_connections JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS physiology_connections JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS pathology_connections JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS semantic_focus_windows JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS narrative_priority_map JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- FASE 2: Narrative Medical Intelligence
ALTER TABLE public.cme_narrative_scripts
ADD COLUMN IF NOT EXISTS semantic_plan_id UUID REFERENCES public.cme_semantic_plans(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS render_job_id UUID,
ADD COLUMN IF NOT EXISTS emotional_curve JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pacing_curve JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS emphasis_map JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS retention_reinforcement_points JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recovery_insertions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS narrative_style TEXT DEFAULT 'professional_medical',
ADD COLUMN IF NOT EXISTS generated_by_model TEXT;

-- FASE 3: Scene Graph Generator
ALTER TABLE public.cme_scene_graphs
ADD COLUMN IF NOT EXISTS semantic_plan_id UUID REFERENCES public.cme_semantic_plans(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS narrative_script_id UUID REFERENCES public.cme_narrative_scripts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scene_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scene_type TEXT, -- hook, pathology_map, physiology_map, pharmacology_flow, etc.
ADD COLUMN IF NOT EXISTS visual_goal TEXT,
ADD COLUMN IF NOT EXISTS medical_concept TEXT,
ADD COLUMN IF NOT EXISTS animation_type TEXT,
ADD COLUMN IF NOT EXISTS transition_type TEXT DEFAULT 'fade',
ADD COLUMN IF NOT EXISTS focus_elements JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attention_curve JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cognitive_load_level TEXT DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS estimated_duration_seconds NUMERIC,
ADD COLUMN IF NOT EXISTS render_priority INTEGER DEFAULT 50;

-- FASE 4: Adaptive Pacing Engine
CREATE TABLE public.cme_adaptive_pacing_maps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID, -- Back-reference to job
    semantic_plan_id UUID REFERENCES public.cme_semantic_plans(id) ON DELETE CASCADE,
    pacing_curve JSONB NOT NULL, -- Timestamp -> Speed Multiplier
    cognitive_load_curve JSONB,
    fatigue_curve JSONB,
    stress_curve JSONB,
    pause_points JSONB DEFAULT '[]'::jsonb, -- Markers for adaptive pauses
    reinforcement_points JSONB DEFAULT '[]'::jsonb,
    recovery_insertions JSONB DEFAULT '[]'::jsonb,
    flow_state_curve JSONB,
    pacing_mode TEXT DEFAULT 'standard', -- standard, intensive, recovery, etc.
    target_duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 5: Voice Intelligence Engine
CREATE TABLE public.cme_voice_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID,
    scene_id UUID REFERENCES public.cme_scene_graphs(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- ElevenLabs, Azure, Cartesia, Gemini
    voice_id TEXT NOT NULL,
    narration_text TEXT NOT NULL,
    ssml_text TEXT,
    pacing_metadata JSONB DEFAULT '{}'::jsonb,
    emotional_metadata JSONB DEFAULT '{}'::jsonb,
    cognitive_timing_map JSONB DEFAULT '{}'::jsonb, -- Words matched to timestamps
    audio_url TEXT,
    duration_seconds NUMERIC,
    status TEXT DEFAULT 'pending', -- pending, generating, ready, failed
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 6 & 9: Distributed Rendering Infrastructure
ALTER TABLE public.cme_render_jobs
ADD COLUMN IF NOT EXISTS render_stage TEXT DEFAULT 'queued',
ADD COLUMN IF NOT EXISTS adaptive_variant TEXT DEFAULT 'full_lecture',
ADD COLUMN IF NOT EXISTS gpu_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS estimated_vram_mb INTEGER,
ADD COLUMN IF NOT EXISTS distributed_chunks INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS render_checkpoints JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cinematic_score NUMERIC,
ADD COLUMN IF NOT EXISTS retention_projection NUMERIC,
ADD COLUMN IF NOT EXISTS pacing_efficiency_score NUMERIC;

ALTER TABLE public.cme_gpu_workers
ADD COLUMN IF NOT EXISTS render_capacity_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS thermal_state TEXT DEFAULT 'nominal',
ADD COLUMN IF NOT EXISTS active_projects INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parallel_render_limit INTEGER DEFAULT 1;

-- FASE 7: Auto Recovery
ALTER TABLE public.cme_render_failures
ADD COLUMN IF NOT EXISTS recovery_strategy TEXT, -- retry_same_worker, downgrade_quality, etc.
ADD COLUMN IF NOT EXISTS rerender_parent_job_id UUID,
ADD COLUMN IF NOT EXISTS rerender_reason TEXT,
ADD COLUMN IF NOT EXISTS recovery_logs JSONB DEFAULT '[]'::jsonb;

-- FASE 10: Multimodal Analytics
ALTER TABLE public.cme_multimodal_analytics
ADD COLUMN IF NOT EXISTS replay_hotspots JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS abandonment_points JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pacing_efficiency NUMERIC,
ADD COLUMN IF NOT EXISTS cognitive_load_score NUMERIC,
ADD COLUMN IF NOT EXISTS fatigue_score NUMERIC,
ADD COLUMN IF NOT EXISTS tutor_dependency_score NUMERIC,
ADD COLUMN IF NOT EXISTS drift_probability NUMERIC,
ADD COLUMN IF NOT EXISTS cinematic_retention_score NUMERIC,
ADD COLUMN IF NOT EXISTS multimodal_mastery_score NUMERIC;

-- Enable RLS for new tables
ALTER TABLE public.cme_adaptive_pacing_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_voice_assets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage pacing maps" ON public.cme_adaptive_pacing_maps FOR ALL USING (true);
CREATE POLICY "Admins can manage voice assets" ON public.cme_voice_assets FOR ALL USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_cme_semantic_plans_updated_at
BEFORE UPDATE ON public.cme_semantic_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();