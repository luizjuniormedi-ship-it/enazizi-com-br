-- Session Modes and Thresholds
ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS current_session_mode TEXT DEFAULT 'balanced' CHECK (current_session_mode IN ('silent', 'balanced', 'intense', 'recovery')),
ADD COLUMN IF NOT EXISTS fatigue_index DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_speed_index DOUBLE PRECISION DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS multimodal_preference_score JSONB DEFAULT '{"video": 1.0, "text": 1.0, "quiz": 1.0}'::jsonb;

-- Detailed Session Lifecycle Logs
CREATE TABLE IF NOT EXISTS public.adaptive_session_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_id UUID NOT NULL,
    prev_mode TEXT,
    new_mode TEXT,
    trigger_reason TEXT, -- e.g., 'stress_spike', 'manual_override', 'fatigue_detected'
    cognitive_snapshot JSONB, -- {stress, load, friction, fatigue, speed}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adaptive_session_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Students can view their session logs" 
ON public.adaptive_session_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all session logs" 
ON public.adaptive_session_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Trigger to automatically handle Recovery Mode activation based on stress
CREATE OR REPLACE FUNCTION public.check_cognitive_recovery_mode()
RETURNS TRIGGER AS $$
BEGIN
    -- If stress index > 0.85, auto-activate recovery mode
    IF NEW.cognitive_stress_index > 0.85 AND OLD.current_session_mode != 'recovery' THEN
        NEW.current_session_mode := 'recovery';
        NEW.recovery_mode_active := true;
        
        -- Log the transition
        INSERT INTO public.adaptive_session_logs (user_id, session_id, prev_mode, new_mode, trigger_reason, cognitive_snapshot)
        VALUES (NEW.user_id, gen_random_uuid(), OLD.current_session_mode, 'recovery', 'automatic_stress_threshold', 
                jsonb_build_object('stress', NEW.cognitive_stress_index, 'fatigue', NEW.fatigue_index));
    END IF;
    
    -- If stress index drops < 0.4, return to balanced from recovery
    IF NEW.cognitive_stress_index < 0.4 AND OLD.current_session_mode = 'recovery' THEN
        NEW.current_session_mode := 'balanced';
        NEW.recovery_mode_active := false;
        
        INSERT INTO public.adaptive_session_logs (user_id, session_id, prev_mode, new_mode, trigger_reason, cognitive_snapshot)
        VALUES (NEW.user_id, gen_random_uuid(), 'recovery', 'balanced', 'stress_stabilized', 
                jsonb_build_object('stress', NEW.cognitive_stress_index, 'fatigue', NEW.fatigue_index));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_cognitive_session_orchestrator
BEFORE UPDATE ON public.adaptive_student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_cognitive_recovery_mode();
