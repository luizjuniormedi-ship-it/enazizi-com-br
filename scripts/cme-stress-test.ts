import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runStressTest() {
  console.log('--- CME ENTERPRISE+ STRESS TEST ---');
  
  const testUserId = '00000000-0000-0000-0000-000000000000'; // Global stress test user
  const renderCounts = [5, 10, 20];
  const results = [];

  for (const count of renderCounts) {
    console.log(`\nSimulando ${count} renderizações simultâneas...`);
    const startTime = Date.now();
    
    const promises = Array.from({ length: count }).map(async (_, i) => {
      const projectId = crypto.randomUUID();
      
      // 1. Criar Projeto
      const { data: project } = await supabase.from('cme_video_projects').insert({
        id: projectId,
        user_id: testUserId,
        title: `Stress Test Render ${count}-${i}`,
        status: 'processing'
      }).select().single();

      // 2. Persistir Scene Graph (O ponto crítico corrigido)
      const { data: sceneGraph, error: sgError } = await supabase.from('cme_scene_graphs').insert({
        project_id: projectId,
        user_id: testUserId,
        scene_graph: { version: '1.0', nodes: [] },
        graph_payload: { nodes: [], metadata: { stress: true } },
        version: 1,
        status: 'completed'
      }).select().single();

      if (sgError) throw sgError;

      // 3. Criar Render Job
      const { data: job, error: jobError } = await supabase.from('cme_render_jobs').insert({
        project_id: projectId,
        user_id: testUserId,
        scene_graph_id: sceneGraph.id,
        priority: 10,
        status: 'waiting_hardware'
      }).select().single();

      if (jobError) throw jobError;

      // 4. Registrar Evento de Pipeline
      await supabase.from('cme_pipeline_events').insert({
        project_id: projectId,
        user_id: testUserId,
        stage: 'stress_test',
        event_type: 'concurrent_init',
        payload: { index: i, total: count }
      });

      return job.id;
    });

    try {
      const jobIds = await Promise.all(promises);
      const duration = Date.now() - startTime;
      console.log(`✅ ${count} jobs criados em ${duration}ms`);
      results.push({ count, duration, success: true });
    } catch (e) {
      console.error(`❌ Falha no teste de ${count}:`, e);
      results.push({ count, success: false, error: e.message });
    }
  }

  console.log('\n--- RESULTADOS FINAIS ---');
  console.table(results);
}

runStressTest().catch(console.error);
