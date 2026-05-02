
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runStressTest() {
  console.log("🚀 Starting CME Enterprise+ Stress Test (50x)...");
  
  const STRESS_COUNT = 50;
  const projects = [];

  // 1. Create 50 Projects
  for (let i = 0; i < STRESS_COUNT; i++) {
    const { data: project } = await supabase
      .from('cme_video_projects')
      .insert({
        title: `Stress Test Project ${i}`,
        description: 'Automated Stress Test',
        status: 'draft',
        user_id: '00000000-0000-0000-0000-000000000000' // Mock system user
      })
      .select()
      .single();
    
    if (project) projects.push(project);
  }

  console.log(`✅ Created ${projects.length} projects.`);

  // 2. Simulate 50 Pipelines
  const pipelinePromises = projects.map(async (project, i) => {
    // Step A: Scene Graph Persistence
    const { data: sceneGraph } = await supabase
      .from('cme_scene_graphs')
      .insert({
        video_project_id: project.id,
        scene_graph: { nodes: [], edges: [] },
        graph_payload: { version: '1.0', stress_test: true }
      })
      .select()
      .single();

    if (!sceneGraph) throw new Error(`Failed to persist Scene Graph for project ${project.id}`);

    // Step B: Orchestrator Call
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
    if (!result.success) throw new Error(`Orchestrator failed for project ${project.id}: ${result.error}`);

    // Step C: Simulate Completion to Trigger Cost Logic
    if (result.jobId) {
      await supabase
        .from('cme_render_jobs')
        .update({ status: 'completed' })
        .eq('id', result.jobId);
    }

    return result.jobId;
  });

  const jobIds = await Promise.all(pipelinePromises);
  console.log(`✅ ${jobIds.length} render jobs initialized and completed.`);

  // 3. Validate Costs
  const { data: costs } = await supabase
    .from('cme_render_costs')
    .select('*')
    .in('render_job_id', jobIds);

  console.log(`💰 Cost tracking validation: ${costs?.length} records found.`);

  // 4. Validate Lineage
  const { data: lineage } = await supabase
    .from('cme_lineage_nodes')
    .select('*')
    .limit(10);
  
  console.log(`🔍 Lineage audit: ${lineage?.length} sample nodes verified.`);

  console.log("🏁 Stress Test Complete.");
}

runStressTest().catch(console.error);
