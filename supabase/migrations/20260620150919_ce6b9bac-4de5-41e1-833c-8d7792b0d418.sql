
ALTER TABLE public.memory_consolidation_sessions
  ADD COLUMN specialty text,
  ADD COLUMN high_yield_score numeric,
  ADD COLUMN enamed_relevance numeric,
  ADD COLUMN cognitive_state text,
  ADD COLUMN advance_allowed boolean,
  ADD COLUMN micro_reinforcement_required boolean,
  ADD COLUMN rigor_level text CHECK (rigor_level IN ('simplified','standard','full')),
  ADD COLUMN knowledge_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN fsrs_cards_to_create jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN planner_updates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN error_bank_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN enamed_takeaways jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.memory_consolidation_responses
  DROP CONSTRAINT memory_consolidation_responses_step_check;

ALTER TABLE public.memory_consolidation_responses
  ADD CONSTRAINT memory_consolidation_responses_step_check
  CHECK (step IN ('retrieval','generation_effect','clinical_recall','connective_summary','metacog','confidence'));
