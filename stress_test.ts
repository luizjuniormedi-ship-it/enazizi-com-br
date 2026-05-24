const FUNCTION_URL = "https://kojqbvrhodpchtnainla.supabase.co/functions/v1/tutor-v3-premium";
const USER_ID = "00000000-0000-0000-0000-000000000001"; // Test user
const CONVERSATION_ID = crypto.randomUUID();

async function simulateRequest(id: number) {
  console.log(`[User ${id}] Starting request...`);
  const start = Date.now();
  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        message: "O que é insuficiência cardíaca?",
        topic: "Cardiologia",
        userId: USER_ID,
        sessionId: CONVERSATION_ID,
        history: []
      })
    });

    const data = await response.json();
    const duration = Date.now() - start;
    console.log(`[User ${id}] Finished in ${duration}ms. Success: ${!!data.content}`);
    return data;
  } catch (err) {
    console.error(`[User ${id}] Failed:`, err.message);
    return null;
  }
}

console.log("Starting Enterprise Stress Test (5 concurrent users)...");
const startAll = Date.now();
const results = await Promise.all([
  simulateRequest(1),
  simulateRequest(2),
  simulateRequest(3),
]);

const totalDuration = Date.now() - startAll;
const successes = results.filter(r => r && r.content).length;
console.log(`\n--- Stress Test Summary ---`);
console.log(`Total Successes: ${successes}/5`);
console.log(`Total Duration: ${totalDuration}ms`);
console.log(`Avg Duration: ${totalDuration / 5}ms`);
console.log(`---------------------------\n`);
