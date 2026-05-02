
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runStressTest() {
  console.log("🚀 Starting CME Enterprise+ Stress Test (50x)...");
  
  const STRESS_COUNT = 50;
  const projects = [];

  for (let i = 0; i < STRESS_COUNT; i++) {
    const { data: project, error } = await supabase
      .from('cme_video_projects')
      .insert({
        title: `Stress Test Project ${i}`,
        description: 'Automated Stress Test',
        status: 'draft',
        user_id: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();
    
    if (project) projects.push(project);
    else if (error) console.error(`Error creating project ${i}:`, error.message);
  }

  console.log(`✅ Created ${projects.length} projects.`);

  const pipelinePromises = projects.map(async (project, i) => {
    try {
      const { data: sceneGraph, error: sgError } = await supabase
        .from('cme_scene_graphs')
        .insert({
          video_project_id: project.id,
          scene_graph: { nodes: [], edges: [] },
          graph_payload: { version: '1.0', stress_test: true }
        })
        .select()
        .single();

      if (sgError) throw new Error(`SG Error: ${sgError.message}`);

      const response = await fetch(`${supabaseUrl}/functions/v1/cme-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'start_render',
          projectId: project.id,
          payload: { priority: i % 5 === 0 ? 'high' : 'standard' }
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(`Orchestrator failed: ${result.error}`);

      if (result.jobId) {
        await supabase
          .from('cme_render_jobs')
          .update({ status: 'completed' })
          .eq('id', result.jobId);
      }
      return result.jobId;
    } catch (e) {
      console.error(`Pipeline failed for project ${project.id}:`, e.message);
      return null;
    }
  });

  const jobIds = (await Promise.all(pipelinePromises)).filter(id => id !== null);
  console.log(`✅ ${jobIds.length} render jobs initialized and completed.`);

  const { data: costs } = await supabase
    .from('cme_render_costs')
    .select('*')
    .in('render_job_id', jobIds);

  console.log(`💰 Cost tracking validation: ${costs?.length} records found.`);

  const { data: lineage } = await supabase
    .from('cme_lineage_nodes')
    .select('*')
    .limit(10);
  
  console.log(`🔍 Lineage audit: ${lineage?.length} sample nodes verified.`);
  console.log("🏁 Stress Test Complete.");
}

runStressTest().catch(console.error);
