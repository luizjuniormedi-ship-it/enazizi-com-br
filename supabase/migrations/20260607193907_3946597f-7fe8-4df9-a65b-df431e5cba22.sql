CREATE TABLE public.topic_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_topic TEXT NOT NULL,
    alias TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(canonical_topic, alias)
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_aliases TO authenticated;
GRANT ALL ON public.topic_aliases TO service_role;

-- Enable RLS
ALTER TABLE public.topic_aliases ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active aliases" ON public.topic_aliases
    FOR SELECT USING (active = true);

-- Seed initial high-priority aliases
INSERT INTO public.topic_aliases (canonical_topic, alias) VALUES
('IAM', 'IAM'),
('IAM', 'Infarto Agudo do Miocárdio'),
('IAM', 'Infarto Agudo do Miocardio'),
('IAM', 'Síndrome Coronariana Aguda'),
('IAM', 'Sindrome Coronariana Aguda'),
('IAM', 'SCA'),
('IAM', 'STEMI'),
('IAM', 'NSTEMI'),
('IAM', 'IAM com Supra'),
('IAM', 'IAM sem Supra'),
('Pericardite', 'Pericardite'),
('Pericardite', 'Tamponamento Cardíaco'),
('Pericardite', 'Tamponamento Cardiaco'),
('CAD Pediátrica', 'CAD'),
('CAD Pediátrica', 'Cetoacidose Diabética'),
('CAD Pediátrica', 'Cetoacidose Diabetica'),
('CAD Pediátrica', 'CAD Pediátrica'),
('CAD Pediátrica', 'Complicações da CAD');
