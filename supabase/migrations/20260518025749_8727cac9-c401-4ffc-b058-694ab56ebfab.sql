CREATE OR REPLACE VIEW public.ingestion_dashboard AS
SELECT 
    status,
    COUNT(*) as file_count,
    SUM(questions_saved) as total_questions,
    (SELECT COUNT(*) FROM public.flashcards WHERE generation_method = 'drive-ingestion-v1') as total_flashcards,
    MAX(created_at) as last_activity
FROM public.drive_ingestion_log
GROUP BY status;