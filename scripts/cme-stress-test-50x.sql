
DO $$
DECLARE
  stress_count INT := 50;
  i INT;
  v_project_id UUID;
  v_job_id UUID;
  v_queue_id UUID;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- Get queue
  SELECT id INTO v_queue_id FROM public.cme_render_queues WHERE name = 'Standard' LIMIT 1;

  FOR i IN 1..stress_count LOOP
    -- 1. Create Project
    INSERT INTO public.cme_video_projects (title, status, user_id)
    VALUES ('Stress Test Project ' || i, 'draft', '00000000-0000-0000-0000-000000000000')
    RETURNING id INTO v_project_id;

    -- 2. Create Scene Graph
    INSERT INTO public.cme_scene_graphs (video_project_id, scene_graph, graph_payload)
    VALUES (v_project_id, '{}'::jsonb, '{"stress": true}'::jsonb);

    -- 3. Create Render Job
    v_start_time := now() - (interval '5 minutes');
    INSERT INTO public.cme_render_jobs (project_id, status, queue_id, user_id, render_metadata, created_at)
    VALUES (v_project_id, 'queued', v_queue_id, '00000000-0000-0000-0000-000000000000', '{"priority": "standard"}'::jsonb, v_start_time)
    RETURNING id INTO v_job_id;

    -- 4. Complete Render Job (to trigger costs)
    UPDATE public.cme_render_jobs 
    SET status = 'completed', updated_at = now()
    WHERE id = v_job_id;

    -- 5. Add Lineage Node
    INSERT INTO public.cme_lineage_nodes (type, entity_id, metadata)
    VALUES ('stress_test', v_project_id, jsonb_build_object('job_id', v_job_id));

  END LOOP;
END $$;
