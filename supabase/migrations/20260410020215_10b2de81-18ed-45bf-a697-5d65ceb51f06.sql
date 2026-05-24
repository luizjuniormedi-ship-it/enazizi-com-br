UPDATE public.medical_image_assets
SET is_active = false,
    integrity_status = 'generic_image',
    review_status = 'blocked_clinical'
WHERE image_url IN (
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-005_curated_1775683631533.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-001_curated_1775683641604.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-008_curated_1775683622342.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-004_curated_1775683637357.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-003_curated_1775683659728.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-007_curated_1775683619527.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-real-009_curated_1775683664108.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-pericardite-403_curated_1775685063648.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ecg-tsv-401_curated_1775685074083.png',
  'https://qszsyskumcmuknumwxtk.supabase.co/storage/v1/object/public/question-images/ecg/ECG-HIPOCAL-202_curated_1775685747497.png'
);