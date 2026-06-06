-- 1. Criar Plantão de Stress Test
INSERT INTO public.hospital_duty_sessions (id, user_id, started_at, metadata)
VALUES ('00000000-0000-4000-a000-000000000000', '095cf92f-427d-48e1-accc-31b357b2fa50', now(), '{"type": "stress_test", "version": "5.9+"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir Pacientes na Sala Vermelha
INSERT INTO public.hospital_patients (id, duty_session_id, name, age, gender, sector, current_status, main_complaint, vitals, hidden_diagnosis)
VALUES 
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 1 (J.M.)', 62, 'M', 'sala_vermelha', 'critico', 'Dor no peito irradiando para mandíbula', '{"PA": "140/90", "FC": "110", "FR": "22", "Temp": "36.5", "SpO2": "94"}', 'Infarto Agudo do Miocárdio com supra de ST'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 2 (A.S.)', 75, 'F', 'sala_vermelha', 'critico', 'Confusão mental e febre', '{"PA": "80/40", "FC": "125", "FR": "28", "Temp": "39.2", "SpO2": "91"}', 'Choque Séptico'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 3 (R.F.)', 58, 'M', 'sala_vermelha', 'critico', 'Fraqueza súbita no lado esquerdo', '{"PA": "180/100", "FC": "88", "FR": "16", "Temp": "36.7", "SpO2": "97"}', 'AVC Isquêmico'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 4 (M.L.)', 70, 'F', 'sala_vermelha', 'critico', 'Cansaço extremo para respirar', '{"PA": "200/120", "FC": "115", "FR": "32", "Temp": "36.4", "SpO2": "85"}', 'Edema Agudo de Pulmão');

-- 3. Inserir Pacientes na Sala Amarela
INSERT INTO public.hospital_patients (id, duty_session_id, name, age, gender, sector, current_status, main_complaint, vitals)
VALUES 
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 5 (Pneumonia)', 45, 'M', 'sala_amarela', 'estavel', 'Tosse produtiva e dor pleurítica', '{"PA": "120/80", "FC": "88", "FR": "18", "Temp": "38.5", "SpO2": "95"}'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 6 (CAD)', 22, 'F', 'sala_amarela', 'instavel', 'Hálito cetônico, náuseas e dor abdominal', '{"PA": "100/60", "FC": "120", "FR": "24", "Temp": "36.8", "SpO2": "98"}'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 7 (Pielonefrite)', 30, 'F', 'sala_amarela', 'estavel', 'Febre e dor lombar intensa', '{"PA": "115/75", "FC": "92", "FR": "16", "Temp": "38.9", "SpO2": "97"}'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 8 (Hipercalemia)', 55, 'M', 'sala_amarela', 'instavel', 'Fraqueza muscular, DRC prévia', '{"PA": "130/80", "FC": "52", "FR": "14", "Temp": "36.5", "SpO2": "96"}');

-- 4. Inserir Pacientes na Sala Verde
INSERT INTO public.hospital_patients (id, duty_session_id, name, age, gender, sector, current_status, main_complaint)
VALUES 
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 9 (Lombalgia)', 38, 'M', 'sala_verde', 'estavel', 'Dor nas costas após esforço'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 10 (Cefaleia)', 28, 'F', 'sala_verde', 'estavel', 'Dor de cabeça tensional'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 11 (GEI)', 5, 'M', 'sala_verde', 'estavel', 'Vômitos e diarreia'),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000000', 'Paciente 12 (ITU)', 24, 'F', 'sala_verde', 'estavel', 'Ardor ao urinar');
