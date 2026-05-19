ALTER TABLE public.planner_extracted_topics 
ADD COLUMN IF NOT EXISTS topics_json JSONB,
ADD COLUMN IF NOT EXISTS coverage_stats JSONB;
