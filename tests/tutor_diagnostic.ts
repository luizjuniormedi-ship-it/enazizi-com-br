const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN; // We'll need a token for real testing

async function runTutorTest(name: string, payload: any) {
  console.log(`\n--- RUNNING TEST: ${name} ---`);
  try {
    const startTime = Date.now();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mentor-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_USER_TOKEN || SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY || ''
      },
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - startTime;
    console.log(`Status: ${response.status} (${elapsed}ms)`);

    if (payload.jsonResponse || payload.debugOnlyRAG) {
      const data = await response.json();
      console.log('Response JSON:', JSON.stringify(data, null, 2));
      return data;
    } else {
      console.log('Stream started...');
      const reader = response.body?.getReader();
      let chunks = 0;
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        chunks++;
        if (chunks === 1) console.log('First chunk received!');
      }
      console.log(`Stream finished. Received ${chunks} chunks.`);
      return { ok: true, chunks };
    }
  } catch (err: any) {
    console.error(`Test ${name} FAILED:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function main() {
  if (!SUPABASE_URL) {
    console.error("Missing SUPABASE_URL");
    return;
  }

  // Test 1: Provider Puro
  await runTutorTest("Provider Puro", {
    message: "Responda apenas: API OK",
    bypassRAG: true,
    jsonResponse: true
  });

  // Test 2: RAG Puro
  await runTutorTest("RAG Puro", {
    message: "TEP",
    debugOnlyRAG: true
  });

  // Test 3: Pipeline Completo (Stream)
  await runTutorTest("Pipeline Completo (Stream)", {
    messages: [{ role: "user", content: "Qual o tratamento da insuficiência cardíaca?" }],
    conversationId: "test-pipeline-" + Date.now()
  });
}

main();
