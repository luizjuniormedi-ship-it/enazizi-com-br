DELETE FROM public.drive_ingestion_log
WHERE status IN ('pending', 'processing')
  AND file_name IN (
    '1. Boas-vindas.pdf',
    '2. Cronogramas.pdf',
    '10. Criminalística.pdf',
    '11. Medicina Legal.pdf'
  );