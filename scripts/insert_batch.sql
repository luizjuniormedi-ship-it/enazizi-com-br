
-- Read the JSON file and insert into questions_bank
INSERT INTO public.questions_bank (
  user_id, 
  statement, 
  options, 
  correct_index, 
  explanation, 
  topic, 
  is_global, 
  review_status, 
  quality_tier
) 
SELECT 
  (value->>'user_id')::uuid, 
  value->>'statement', 
  ARRAY(SELECT jsonb_array_elements_text(value->'options')), 
  (value->>'correct_index')::int, 
  value->>'explanation', 
  value->>'topic', 
  (value->>'is_global')::boolean, 
  value->>'review_status', 
  value->>'quality_tier' 
FROM jsonb_array_elements(pg_read_file('/dev-server/validation_batch.json')::jsonb) as value;
