-- Função para logar drift quando o peso muda significativamente
CREATE OR REPLACE FUNCTION public.log_exam_blueprint_drift()
RETURNS TRIGGER AS $$
BEGIN
    IF (ABS(NEW.weight - OLD.weight) >= 1.0) THEN
        INSERT INTO public.exam_drift_logs (exam_key, topic, old_weight, new_weight, delta, reason)
        VALUES (
            NEW.exam_key, 
            NEW.topic, 
            OLD.weight, 
            NEW.weight, 
            NEW.weight - OLD.weight, 
            'Recalibração automática via Intelligence Engine'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de Drift
CREATE OR REPLACE TRIGGER trigger_log_blueprint_drift
AFTER UPDATE ON public.exam_blueprints
FOR EACH ROW
WHEN (OLD.weight IS DISTINCT FROM NEW.weight)
EXECUTE FUNCTION public.log_exam_blueprint_drift();
