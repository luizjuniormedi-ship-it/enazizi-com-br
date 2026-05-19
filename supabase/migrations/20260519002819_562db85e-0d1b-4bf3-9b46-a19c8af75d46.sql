-- Create study_plan_items for macro plan subjects
CREATE TABLE IF NOT EXISTS public.study_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    discipline TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    estimated_minutes INTEGER DEFAULT 45,
    priority_score INTEGER DEFAULT 50,
    difficulty TEXT DEFAULT 'medio',
    source TEXT DEFAULT 'edital',
    week_number INTEGER,
    planned_date DATE,
    status TEXT DEFAULT 'pending',
    completion_percent INTEGER DEFAULT 0,
    linked_questions UUID[],
    linked_flashcards UUID[],
    linked_tutor_session UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own study plan items"
    ON public.study_plan_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own study plan items"
    ON public.study_plan_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own study plan items"
    ON public.study_plan_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own study plan items"
    ON public.study_plan_items FOR DELETE
    USING (auth.uid() = user_id);

-- Add update trigger for updated_at
CREATE TRIGGER update_study_plan_items_updated_at
    BEFORE UPDATE ON public.study_plan_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add meta columns to study_plans if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'exam_name') THEN
        ALTER TABLE public.study_plans ADD COLUMN exam_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'exam_date') THEN
        ALTER TABLE public.study_plans ADD COLUMN exam_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'daily_available_minutes') THEN
        ALTER TABLE public.study_plans ADD COLUMN daily_available_minutes INTEGER DEFAULT 240;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'weekly_available_days') THEN
        ALTER TABLE public.study_plans ADD COLUMN weekly_available_days INTEGER DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'start_date') THEN
        ALTER TABLE public.study_plans ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'end_date') THEN
        ALTER TABLE public.study_plans ADD COLUMN end_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_plans' AND column_name = 'source') THEN
        ALTER TABLE public.study_plans ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
END $$;