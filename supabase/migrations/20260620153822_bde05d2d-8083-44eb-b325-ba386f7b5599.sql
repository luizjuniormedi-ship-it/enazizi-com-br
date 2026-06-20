INSERT INTO public.system_flags (flag_key, enabled, description)
VALUES ('memory_consolidation_enabled', false, 'MCE V4: liga o MemoryConsolidationCard no SessaoEstudo (shadow mode quando false).')
ON CONFLICT (flag_key) DO NOTHING;