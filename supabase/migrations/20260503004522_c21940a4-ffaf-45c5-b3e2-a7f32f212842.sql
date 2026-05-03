-- Re-attempting table creation without complex role check in policy for now to ensure stability
CREATE TABLE IF NOT EXISTS public.lesson_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.tutor_lesson_memory(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    watched_percentage NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.lesson_ratings ENABLE ROW LEVEL SECURITY;

-- Basic Policies
DROP POLICY IF EXISTS "Users can view their own ratings" ON public.lesson_ratings;
CREATE POLICY "Users can view their own ratings"
    ON public.lesson_ratings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.lesson_ratings;
CREATE POLICY "Users can insert their own ratings"
    ON public.lesson_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ratings" ON public.lesson_ratings;
CREATE POLICY "Users can update their own ratings"
    ON public.lesson_ratings FOR UPDATE
    USING (auth.uid() = user_id);

-- Simple admin policy (based on metadata or dedicated check if needed)
DROP POLICY IF EXISTS "Admins can view all ratings" ON public.lesson_ratings;
CREATE POLICY "Admins can view all ratings"
    ON public.lesson_ratings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin')
        )
    );

-- View for analytics
CREATE OR REPLACE VIEW public.lesson_rating_stats AS
SELECT 
    lesson_id,
    COUNT(*) as total_ratings,
    AVG(rating)::numeric(3,2) as average_rating,
    COUNT(*) FILTER (WHERE rating = 5) as five_star_count,
    (COUNT(*) FILTER (WHERE rating = 5) * 100.0 / NULLIF(COUNT(*), 0))::numeric(5,2) as five_star_percentage
FROM public.lesson_ratings
GROUP BY lesson_id;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_lesson_id ON public.lesson_ratings(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_user_id ON public.lesson_ratings(user_id);
