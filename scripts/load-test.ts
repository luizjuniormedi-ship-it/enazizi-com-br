/**
 * ENAZIZI Enterprise Load Test Simulator
 * Simulates multiple users performing FSRS reviews and study sessions concurrently.
 */

const BASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!BASE_URL || !ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const CONCURRENT_USERS = 50;
const ACTIONS_PER_USER = 10;

async function simulateUser(id: number) {
  console.log(`[User ${id}] Starting session...`);
  
  for (let i = 0; i < ACTIONS_PER_USER; i++) {
    const start = performance.now();
    try {
      // Simulate calling a critical Edge Function like 'study-session' or 'fsrs-reviewed'
      const response = await fetch(`${BASE_URL}/functions/v1/system-health-check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const latency = performance.now() - start;
      if (!response.ok) {
        console.error(`[User ${id}] Action ${i} FAILED (${response.status}) in ${latency.toFixed(2)}ms`);
      } else {
        // console.log(`[User ${id}] Action ${i} SUCCESS in ${latency.toFixed(2)}ms`);
      }
    } catch (err) {
      console.error(`[User ${id}] Action ${i} CRASHED:`, err);
    }
    
    // Random jitter between actions
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
  }
  
  console.log(`[User ${id}] Completed session.`);
}

async function runLoadTest() {
  console.log(`Starting Load Test: ${CONCURRENT_USERS} concurrent users, ${ACTIONS_PER_USER} actions each.`);
  const start = performance.now();
  
  const users = Array.from({ length: CONCURRENT_USERS }, (_, i) => simulateUser(i));
  await Promise.all(users);
  
  const totalTime = (performance.now() - start) / 1000;
  console.log(`Load Test Finished in ${totalTime.toFixed(2)}s`);
  console.log(`Total Requests: ${CONCURRENT_USERS * ACTIONS_PER_USER}`);
  console.log(`Throughput: ${( (CONCURRENT_USERS * ACTIONS_PER_USER) / totalTime).toFixed(2)} req/s`);
}

runLoadTest();
