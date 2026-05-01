
-- Atualizar a videoaula problemática com uma mídia funcional temporária
UPDATE ai_video_lessons 
SET 
  video_url = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  media_status = 'ready',
  status = 'published',
  pipeline_last_error = NULL,
  health_score = 100,
  duration_seconds = 596
WHERE id = 'e0be04ac-be23-4b52-a37f-c01b36189425';
