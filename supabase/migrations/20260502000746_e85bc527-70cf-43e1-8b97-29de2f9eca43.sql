-- 1. Create worker ID
DO $$
DECLARE
  v_worker_id UUID := gen_random_uuid();
  v_queue_id UUID;
  v_user_id UUID := 'a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023';
  v_project_id UUID;
  v_job_id UUID;
  v_start_time TIMESTAMPTZ;
  stress_count INT := 50;
BEGIN
  -- 2. Create mock worker in both tables to satisfy FKs
  INSERT INTO public.cme_gpu_workers (id, worker_name, status, vram_total_mb, vram_used_mb)
  VALUES (v_worker_id, 'stress-test-worker-global', 'online', 24576, 0)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.cme_worker_nodes (id, hostname, status, vram_total_mb, vram_used_mb)
  VALUES (v_worker_id, 'stress-test-worker-global', 'online', 24576, 0)
  ON CONFLICT DO NOTHING;

  -- Get queue
  SELECT id INTO v_queue_id FROM public.cme_render_queues WHERE name = 'Standard' LIMIT 1;

  -- 3. Run Stress Test
  FOR i IN 1..stress_count LOOP
    -- 1. Create Project
    INSERT INTO public.cme_video_projects (title, status, user_id)
    VALUES ('Stress Test Project ' || i, 'draft', v_user_id)
    RETURNING id INTO v_project_id;

    -- 2. Create Scene Graph
    INSERT INTO public.cme_scene_graphs (video_project_id, scene_graph, graph_payload)
    VALUES (v_project_id, '{}'::jsonb, '{"stress": true}'::jsonb);

    -- 3. Create Render Job
    v_start_time := now() - (interval '5 minutes');
    INSERT INTO public.cme_render_jobs (project_id, status, queue_id, user_id, render_metadata, queued_at, render_type, gpu_worker_id)
    VALUES (v_project_id, 'queued', v_queue_id, v_user_id, '{"priority": "standard"}'::jsonb, v_start_time, 'full_lecture', v_worker_id)
    RETURNING id INTO v_job_id;

    -- 4. Complete Render Job (to trigger costs)
    UPDATE public.cme_render_jobs 
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_job_id;

    -- 5. Add Lineage Node
    INSERT INTO public.cme_lineage_nodes (type, entity_id, metadata)
    VALUES ('stress_test', v_project_id, jsonb_build_object('job_id', v_job_id));
  END LOOP;
END $$;
