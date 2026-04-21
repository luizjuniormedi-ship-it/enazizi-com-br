-- =============================================================
-- PROFICIÊNCIA GUIADA — Fase 1
-- =============================================================

CREATE TABLE public.professor_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  exam_date DATE,
  intensity TEXT NOT NULL DEFAULT 'moderado' CHECK (intensity IN ('leve','moderado','intenso')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','finished')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_professor_plans_created_by ON public.professor_plans(created_by);
CREATE INDEX idx_professor_plans_status ON public.professor_plans(status);

CREATE TABLE public.professor_plan_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  user_id UUID,
  class_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL) OR (class_id IS NOT NULL))
);
CREATE INDEX idx_pp_targets_plan ON public.professor_plan_targets(plan_id);
CREATE INDEX idx_pp_targets_user ON public.professor_plan_targets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_pp_targets_class ON public.professor_plan_targets(class_id) WHERE class_id IS NOT NULL;

CREATE TABLE public.professor_plan_subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  subtopic_id UUID NOT NULL REFERENCES public.curriculum_subtopics(id) ON DELETE RESTRICT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, subtopic_id)
);
CREATE INDEX idx_pp_subtopics_plan ON public.professor_plan_subtopics(plan_id);
CREATE INDEX idx_pp_subtopics_subtopic ON public.professor_plan_subtopics(subtopic_id);

CREATE TABLE public.professor_plan_linked_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('simulado','assignment','clinical_case','video_room','mentor_plan')),
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, resource_type, resource_id)
);
CREATE INDEX idx_pp_linked_plan ON public.professor_plan_linked_resources(plan_id);

CREATE TABLE public.professor_plan_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_week INTEGER NOT NULL DEFAULT 1,
  weekly_goal_status TEXT NOT NULL DEFAULT 'partial' CHECK (weekly_goal_status IN ('done','partial','missed')),
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  pending_tasks INTEGER NOT NULL DEFAULT 0,
  overdue_tasks INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, user_id)
);
CREATE INDEX idx_pp_progress_plan ON public.professor_plan_progress(plan_id);
CREATE INDEX idx_pp_progress_user ON public.professor_plan_progress(user_id);

CREATE TABLE public.professor_plan_recalculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  user_id UUID,
  recalculation_type TEXT NOT NULL CHECK (recalculation_type IN ('teacher_update','missed_goal','auto')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_recalc_plan ON public.professor_plan_recalculations(plan_id);
CREATE INDEX idx_pp_recalc_user ON public.professor_plan_recalculations(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE public.professor_plan_daily_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.professor_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  planned_date DATE NOT NULL,
  task_type TEXT NOT NULL,
  task_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped','overdue')),
  source TEXT NOT NULL DEFAULT 'planner',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pp_daily_plan_user_date ON public.professor_plan_daily_tasks(plan_id, user_id, planned_date);
CREATE INDEX idx_pp_daily_user_date ON public.professor_plan_daily_tasks(user_id, planned_date);

-- =============================================================
-- Helpers SECURITY DEFINER
-- =============================================================
CREATE OR REPLACE FUNCTION public.user_is_target_of_plan(_user_id UUID, _plan_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professor_plan_targets t
    WHERE t.plan_id = _plan_id
      AND (
        t.user_id = _user_id
        OR (t.class_id IS NOT NULL AND t.class_id IN (
              SELECT cm.class_id FROM public.class_members cm
              WHERE cm.user_id = _user_id AND cm.is_active = true
        ))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.professor_owns_plan(_user_id UUID, _plan_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.professor_plans p WHERE p.id = _plan_id AND p.created_by = _user_id);
$$;

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE public.professor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_linked_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_recalculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_plan_daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "professor_plans_owner_all" ON public.professor_plans FOR ALL
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "professor_plans_target_select" ON public.professor_plans FOR SELECT
  USING (user_is_target_of_plan(auth.uid(), id));

CREATE POLICY "pp_targets_owner_all" ON public.professor_plan_targets FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_targets_target_select" ON public.professor_plan_targets FOR SELECT
  USING (user_is_target_of_plan(auth.uid(), plan_id));

CREATE POLICY "pp_subtopics_owner_all" ON public.professor_plan_subtopics FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_subtopics_target_select" ON public.professor_plan_subtopics FOR SELECT
  USING (user_is_target_of_plan(auth.uid(), plan_id));

CREATE POLICY "pp_linked_owner_all" ON public.professor_plan_linked_resources FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_linked_target_select" ON public.professor_plan_linked_resources FOR SELECT
  USING (user_is_target_of_plan(auth.uid(), plan_id));

CREATE POLICY "pp_progress_owner_all" ON public.professor_plan_progress FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_progress_self_select" ON public.professor_plan_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "pp_recalc_owner_all" ON public.professor_plan_recalculations FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_recalc_target_select" ON public.professor_plan_recalculations FOR SELECT
  USING (user_id = auth.uid() OR user_is_target_of_plan(auth.uid(), plan_id));

CREATE POLICY "pp_daily_owner_all" ON public.professor_plan_daily_tasks FOR ALL
  USING (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (professor_owns_plan(auth.uid(), plan_id) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "pp_daily_self_select" ON public.professor_plan_daily_tasks FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "pp_daily_self_update" ON public.professor_plan_daily_tasks FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================
-- Triggers updated_at (usa função existente public.update_updated_at)
-- =============================================================
CREATE TRIGGER trg_pp_plans_updated BEFORE UPDATE ON public.professor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pp_progress_updated BEFORE UPDATE ON public.professor_plan_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_pp_daily_updated BEFORE UPDATE ON public.professor_plan_daily_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();