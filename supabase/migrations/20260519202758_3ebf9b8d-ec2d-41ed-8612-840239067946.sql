-- Create trajectory tracking for longitudinal governance
CREATE TABLE IF NOT EXISTS public.study_trajectories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  current_week INTEGER NOT NULL DEFAULT 1,
  total_weeks INTEGER NOT NULL,
  exam_date DATE,
  viability_score INTEGER DEFAULT 100, -- 0-100 score of plan feasibility
  risk_level TEXT DEFAULT 'low', -- low, moderate, high, critical
  status TEXT DEFAULT 'active', -- active, completed, paused, adjusted
  telemetry_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_trajectories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own trajectory"
ON public.study_trajectories FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own trajectory"
ON public.study_trajectories FOR ALL USING (auth.uid() = user_id);

-- Telemetry log for longitudinal events
CREATE TABLE IF NOT EXISTS public.planner_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- study_plan_recalculated, week_overloaded, trajectory_risk_detected, mission_macro_sync
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.planner_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own telemetry" ON public.planner_telemetry FOR SELECT USING (auth.uid() = user_id);

-- Helper functions for longitudinal logic
CREATE OR REPLACE FUNCTION public.calculate_plan_viability(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_days_left INTEGER;
  v_pending_hours FLOAT;
  v_daily_capacity FLOAT;
  v_score INTEGER;
BEGIN
  -- Simple viability logic: (Capacity * Days) / Required Hours
  SELECT (exam_date - CURRENT_DATE) INTO v_days_left
  FROM public.profiles WHERE id = target_user_id;
  
  SELECT daily_study_hours INTO v_daily_capacity
  FROM public.profiles WHERE id = target_user_id;

  SELECT SUM(estimated_minutes) / 60.0 INTO v_pending_hours
  FROM public.study_plan_items i
  JOIN public.study_plans p ON i.study_plan_id = p.id
  WHERE p.user_id = target_user_id AND i.status = 'pending' AND p.status = 'completed';

  IF v_days_left IS NULL OR v_days_left <= 0 OR v_daily_capacity IS NULL OR v_pending_hours IS NULL THEN
    RETURN 100;
  END IF;

  v_score := LEAST(100, ROUND((v_daily_capacity * v_days_left / NULLIF(v_pending_hours, 0)) * 100));
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
