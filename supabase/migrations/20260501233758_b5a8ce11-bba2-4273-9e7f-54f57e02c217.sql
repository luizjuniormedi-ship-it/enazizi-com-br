-- 1. Garantir que graph_payload existe
ALTER TABLE public.cme_scene_graphs
ADD COLUMN IF NOT EXISTS graph_payload jsonb DEFAULT '{}'::jsonb;

-- 2. Permitir que scene_graph tenha um default para não quebrar inserts parciais antes da trigger
ALTER TABLE public.cme_scene_graphs
ALTER COLUMN scene_graph SET DEFAULT '{}'::jsonb;

-- 3. Sincronizar dados existentes
UPDATE public.cme_scene_graphs
SET scene_graph = COALESCE(scene_graph, graph_payload, '{}'::jsonb)
WHERE scene_graph IS NULL OR scene_graph = '{}'::jsonb;

UPDATE public.cme_scene_graphs
SET graph_payload = COALESCE(graph_payload, scene_graph, '{}'::jsonb)
WHERE graph_payload IS NULL OR graph_payload = '{}'::jsonb;

-- 4. Criar função de sincronização
CREATE OR REPLACE FUNCTION public.sync_cme_scene_graph_payload()
RETURNS trigger AS $$
BEGIN
  -- Se scene_graph for null ou vazio, tenta pegar de graph_payload
  IF NEW.scene_graph IS NULL OR NEW.scene_graph = '{}'::jsonb THEN
    IF NEW.graph_payload IS NOT NULL AND NEW.graph_payload <> '{}'::jsonb THEN
      NEW.scene_graph := NEW.graph_payload;
    END IF;
  END IF;

  -- Se graph_payload for null ou vazio, tenta pegar de scene_graph
  IF NEW.graph_payload IS NULL OR NEW.graph_payload = '{}'::jsonb THEN
    IF NEW.scene_graph IS NOT NULL AND NEW.scene_graph <> '{}'::jsonb THEN
      NEW.graph_payload := NEW.scene_graph;
    END IF;
  END IF;

  -- Fallback final para garantir que scene_graph nunca seja null
  IF NEW.scene_graph IS NULL THEN
    NEW.scene_graph := '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger
DROP TRIGGER IF EXISTS trg_sync_cme_scene_graph_payload ON public.cme_scene_graphs;

CREATE TRIGGER trg_sync_cme_scene_graph_payload
BEFORE INSERT OR UPDATE ON public.cme_scene_graphs
FOR EACH ROW
EXECUTE FUNCTION public.sync_cme_scene_graph_payload();

-- 6. Recarregar schema cache
NOTIFY pgrst, 'reload schema';