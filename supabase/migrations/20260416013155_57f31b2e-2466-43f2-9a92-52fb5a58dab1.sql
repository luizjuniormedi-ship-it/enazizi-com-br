
-- Tabela de mapas mentais
CREATE TABLE public.mental_maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_topic TEXT,
  specialty TEXT,
  difficulty TEXT DEFAULT 'medium',
  source_type TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_mental_maps_user_id ON public.mental_maps(user_id);
CREATE INDEX idx_mental_maps_specialty ON public.mental_maps(specialty);
CREATE INDEX idx_mental_maps_tags ON public.mental_maps USING GIN(tags);

-- RLS
ALTER TABLE public.mental_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own maps" ON public.mental_maps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own maps" ON public.mental_maps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own maps" ON public.mental_maps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own maps" ON public.mental_maps
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_mental_maps_updated_at
  BEFORE UPDATE ON public.mental_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
