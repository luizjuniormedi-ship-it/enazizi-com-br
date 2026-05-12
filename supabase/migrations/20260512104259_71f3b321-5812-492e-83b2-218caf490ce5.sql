-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT DEFAULT 'system',
    type TEXT DEFAULT 'info',
    action_href TEXT,
    action_label TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
    ON public.notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'ceo')
        )
    );

-- Create question_reports table
CREATE TABLE public.question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    question_id UUID NOT NULL,
    reason TEXT NOT NULL,
    comment TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for question_reports
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- Policies for question_reports
CREATE POLICY "Users can create their own reports"
    ON public.question_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports"
    ON public.question_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reports"
    ON public.question_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'ceo')
        )
    );

-- Trigger for updated_at
CREATE TRIGGER set_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_question_reports_updated_at
    BEFORE UPDATE ON public.question_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
