ALTER TABLE public.drive_ingestion_log ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE TRIGGER update_drive_ingestion_log_updated_at
BEFORE UPDATE ON public.drive_ingestion_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();