DELETE FROM public.drive_ingestion_log
WHERE status IN ('pending', 'processing')
  AND (
    unaccent(upper(file_name)) ~ '(MEDICO LEGISTA|DIREITO PENAL|DIREITO CONSTITUCIONAL|DIREITO ADMINISTRATIVO|DIREITO PROCESSUAL|PORTUGUES|INFORMATICA|CRIMINALISTICA|MEDICINA LEGAL|NOCOES DE DIREITO)'
    OR file_name ~ '^\d+\.\s'
    OR upper(file_name) ~ '^(1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.|9\.|10\.|11\.)'
    OR upper(file_name) LIKE '%RLM%'
    OR upper(file_name) LIKE '%FORENSE%'
    OR upper(file_name) LIKE '%CONSTITUI%'
    OR upper(file_name) LIKE '%TRIBUTARI%'
  );