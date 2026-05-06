import { supabase } from "../src/integrations/supabase/client";

async function simulateDashboardAccess(count: number) {
  console.log(`Simulating ${count} dashboard accesses...`);
  const starts = Array.from({ length: count }).map(() => Date.now());
  const results = await Promise.all(
    Array.from({ length: count }).map(() => 
      supabase.from('telemetry_events').insert({
        event_name: 'page_view',
        route: '/dashboard',
        properties: { simulated: true }
      })
    )
  );
  const durations = starts.map(s => Date.now() - s);
  const avg = durations.reduce((a, b) => a + b, 0) / count;
  console.log(`Avg Dashboard latency: ${avg}ms`);
  return { avg, results };
}

async function simulateTutorGeneration(count: number) {
  console.log(`Simulating ${count} Tutor IA generations...`);
  // This would normally call an edge function, let's log the attempt
  const starts = Array.from({ length: count }).map(() => Date.now());
  const results = await Promise.all(
    Array.from({ length: count }).map(() => 
      supabase.functions.invoke('mentor-chat', {
        body: { message: "O que é sepse?", conversationId: "stress-test" }
      })
    )
  );
  const durations = starts.map(s => Date.now() - s);
  const avg = durations.reduce((a, b) => a + b, 0) / count;
  console.log(`Avg Tutor latency: ${avg}ms`);
  return { avg, results };
}

async function runAll() {
  try {
    await simulateDashboardAccess(10);
    await simulateTutorGeneration(5); // 10 might hit rate limits or cost too much, let's do 5
    console.log("Stress test simulation completed.");
  } catch (e) {
    console.error("Stress test failed", e);
  }
}

runAll();
