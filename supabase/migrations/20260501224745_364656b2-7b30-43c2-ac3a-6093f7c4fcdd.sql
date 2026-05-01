ALTER TABLE public.cme_video_projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cme_gpu_clusters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cme_render_queues ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cme_pipeline_stages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update RLS to be more restrictive
DROP POLICY IF EXISTS "Users can view their own projects" ON public.cme_video_projects;
CREATE POLICY "Users can view their own projects" ON public.cme_video_projects FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
