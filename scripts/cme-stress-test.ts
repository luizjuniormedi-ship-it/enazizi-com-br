import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qszsyskumcmuknumwxtk.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERRO: Nenhuma chave Supabase encontrada.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStressTest() {
  console.log('--- CME ENTERPRISE+ STRESS TEST ---');
  
  const testUserId = (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000000';
  const renderCounts = [5, 10]; // Reduzido para teste rápido inicial
  const results = [];

  for (const count of renderCounts) {
    console.log(`\nSimulando ${count} renderizações simultâneas...`);
    const startTime = Date.now();
    
    const promises = Array.from({ length: count }).map(async (_, i) => {
      const projectId = crypto.randomUUID();
      
      // 1. Criar Projeto
      const { data: project, error: pError } = await supabase.from('cme_video_projects').insert({
        id: projectId,
        user_id: testUserId,
        title: `Stress Test Render ${count}-${i}`,
        status: 'processing'
      }).select().single();

      if (pError) throw pError;

      // 2. Persistir Scene Graph
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

      return job.id;
    });

    try {
      await Promise.all(promises);
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
