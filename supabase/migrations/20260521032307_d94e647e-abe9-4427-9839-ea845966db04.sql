-- Add unique constraint to tutor_learning_memory
ALTER TABLE public.tutor_learning_memory 
ADD CONSTRAINT tutor_learning_memory_user_id_topic_key UNIQUE (user_id, topic);
