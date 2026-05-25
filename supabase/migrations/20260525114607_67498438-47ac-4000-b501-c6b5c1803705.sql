DELETE FROM public.drive_ingestion_log
WHERE status IN ('pending', 'processing', 'failed')
  AND (
    file_name ~ '^[0-9]+(\.[0-9]+)*[\.\s]'
    OR file_name = '1.pdf'
    OR unaccent(upper(file_name)) ~ '(FORENSE|PERICIA|DECLARACAO DE OBITO|SIGILO|ETICA MEDICA|TANATOLOGIA|ASFIXIOLOGIA|TOXICOLOGIA FORENSE|ANTROPOLOGIA FORENSE|SEXOLOGIA FORENSE|CPC|CODIGO PENAL|ART\.|MEDICO-PERICIAL|PERITO|MANUAL OFICIAL DE PERICIA)'
  );