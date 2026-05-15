-- Remove unique constraint on name if it exists (allows multiple URLs for same institution if needed, though URL is better unique key)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'official_exam_sources_name_key') THEN
        ALTER TABLE public.official_exam_sources DROP CONSTRAINT official_exam_sources_name_key;
    END IF;
END $$;

-- Add UNIQUE constraint to URL
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'official_exam_sources_url_key') THEN
        ALTER TABLE public.official_exam_sources ADD CONSTRAINT official_exam_sources_url_key UNIQUE (url);
    END IF;
END $$;

-- Add columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='official_exam_sources' AND column_name='search_terms') THEN
        ALTER TABLE public.official_exam_sources ADD COLUMN search_terms TEXT[] DEFAULT ARRAY['prova residência médica', 'prova objetiva', 'gabarito', 'edital', 'revalida', 'provas anteriores'];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='official_exam_sources' AND column_name='last_historical_scan') THEN
        ALTER TABLE public.official_exam_sources ADD COLUMN last_historical_scan TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Seed residency specific sources with correct URLs
INSERT INTO public.official_exam_sources (name, url, is_active, search_terms)
VALUES 
('ENARE', 'https://enare.ebserh.gov.br', true, ARRAY['prova residência médica', 'gabarito', 'edital']),
('REVALIDA', 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida/provas-e-gabaritos', true, ARRAY['revalida', 'provas e gabaritos']),
('PSU-MG', 'https://aremg.org.br', true, ARRAY['prova residência', 'processo seletivo']),
('AMRIGS', 'https://www.amrigs.org.br', true, ARRAY['prova residência', 'amrigs']),
('HC-FMUSP', 'https://www.fm.usp.br', true, ARRAY['residência médica', 'processo seletivo']),
('UNICAMP', 'https://www.comvest.unicamp.br', true, ARRAY['residência médica', 'comvest']),
('UNIFESP', 'https://coreme.unifesp.br', true, ARRAY['residência médica', 'editais']),
('Einstein', 'https://www.einstein.br', true, ARRAY['residência médica', 'processo seletivo']),
('FGV Med', 'https://conhecimento.fgv.br/concursos/residenciamedica', true, ARRAY['residência médica', 'gabarito']),
('VUNESP Med', 'https://www.vunesp.com.br/concursos/medica', true, ARRAY['residência médica', 'edital'])
ON CONFLICT (url) DO UPDATE SET 
    name = EXCLUDED.name,
    search_terms = EXCLUDED.search_terms;
