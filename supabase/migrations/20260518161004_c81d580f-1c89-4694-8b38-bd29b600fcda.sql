-- Seed lessons table
INSERT INTO public.lessons (id, specialty, topic, title, lesson_type, audio_url, is_active, created_at, updated_at)
VALUES 
(gen_random_uuid(), 'Cardiologia', 'Insuficiência Cardíaca', 'Manejo da IC Aguda na Emergência', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', true, now(), now()),
(gen_random_uuid(), 'Pediatria', 'Puericultura', 'Marcos do Desenvolvimento Infantil', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', true, now(), now()),
(gen_random_uuid(), 'Cirurgia', 'Trauma', 'Atendimento Inicial ao Politraumatizado', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', true, now(), now()),
(gen_random_uuid(), 'Ginecologia', 'Pré-natal', 'Rastreio de Malformações Fetais', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', true, now(), now()),
(gen_random_uuid(), 'Infectologia', 'Sepse', 'Protocolo Sepsis-3 Atualizado', 'audio', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', true, now(), now());

-- Seed enaflix_content table
INSERT INTO public.enaflix_content (id, title, description, specialty, content_type, video_url, thumbnail_url, duration_minutes, difficulty, is_published, created_at, updated_at)
VALUES 
(gen_random_uuid(), 'Masterclass: ECG na Emergência', 'Aprenda a identificar as principais arritmias e sinais de IAM.', 'Cardiologia', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?w=800&auto=format&fit=crop&q=60', 120, 'dificil', true, now(), now()),
(gen_random_uuid(), 'Revisão: Antibióticos para Prova', 'Os esquemas mais cobrados em provas de residência.', 'Infectologia', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=800&auto=format&fit=crop&q=60', 45, 'intermediario', true, now(), now()),
(gen_random_uuid(), 'Cirurgia Geral: Abdome Agudo', 'Diagnóstico diferencial e conduta nos principais casos.', 'Cirurgia', 'video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=60', 60, 'intermediario', true, now(), now());
