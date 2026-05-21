-- Add current_block and expected_action to tutor_sessions
ALTER TABLE public.tutor_sessions 
ADD COLUMN IF NOT EXISTS current_block TEXT DEFAULT 'BLOCO_1_MISSAO_CLINICA',
ADD COLUMN IF NOT EXISTS expected_action TEXT DEFAULT 'student_reply',
ADD COLUMN IF NOT EXISTS should_wait_for_student BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS completed_blocks TEXT[] DEFAULT '{}';

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_current_block ON public.tutor_sessions(current_block);
