ALTER TABLE public.cognitive_states ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add standard trigger for updated_at if it doesn't exist
CREATE TRIGGER set_cognitive_states_updated_at
BEFORE UPDATE ON public.cognitive_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
