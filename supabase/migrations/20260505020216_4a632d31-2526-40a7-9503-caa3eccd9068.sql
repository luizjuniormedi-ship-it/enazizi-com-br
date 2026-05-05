-- Create error_log table
CREATE TABLE IF NOT EXISTS public.error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    component_stack TEXT,
    user_id UUID REFERENCES auth.users(id),
    severity TEXT DEFAULT 'error',
    context JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own error logs"
ON public.error_log
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all error logs"
ON public.error_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);