
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = "https://qszsyskumcmuknumwxtk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDUwNjUsImV4cCI6MjA4NjIyMTA2NX0.B2Si8zb8YJcDhIsyj6edriyXsG3p2rP-NLrGfBFAoZw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConcurrency(count: number) {
  console.log(`\n🔥 STRESS TEST: ${count} parallel calls to ai-proxy...`);
  const start = Date.now();
  
  const promises = Array.from({ length: count }).map(async (_, i) => {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: { prompt: "Say 'ENAZIZI IS READY'", model: "openai/gpt-5-mini" }
    });
    return { id: i, ok: !error, error: error?.message, data };
  });

  const results = await Promise.all(promises);
  const duration = Date.now() - start;
  
  const success = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  
  console.log(`Results: ${success} SUCCESS, ${failed} FAILED in ${duration}ms`);
  
  if (failed > 0) {
    console.log("Error sample:", results.find(r => !r.ok)?.error);
  }
}

async function testRLS() {
  console.log("\n🔒 SECURITY AUDIT (RLS)...");
  
  // 1. Profiles (should return 0 rows for anon)
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id").limit(1);
  if (pErr) {
    console.log("✅ Profiles protected (Error):", pErr.message);
  } else if (profiles && profiles.length > 0) {
    console.log("❌ CRITICAL: Profiles accessible to anon user!");
  } else {
    console.log("✅ Profiles protected (0 rows returned for anon).");
  }

  // 2. Questions table
  const { data: questions, error: qErr } = await supabase.from("questions").select("id").limit(1);
  if (qErr) {
    console.log("✅ Questions protected (Error):", qErr.message);
  } else if (questions && questions.length > 0) {
    console.log("ℹ️ Questions are public (intended behavior?).");
  } else {
    console.log("✅ Questions protected (0 rows).");
  }

  // 3. Admin Logs
  const { data: logs, error: lErr } = await supabase.from("admin_actions_log").select("*").limit(1);
  if (lErr) {
     console.log("✅ Admin Logs protected:", lErr.message);
  } else if (logs && logs.length > 0) {
     console.log("❌ CRITICAL: Admin logs exposed to public!");
  } else {
     console.log("✅ Admin Logs protected (0 rows).");
  }
}

async function testCognitiveStability() {
  console.log("\n🧠 COGNITIVE STABILITY TEST...");
  const start = Date.now();
  
  const { data, error } = await supabase.functions.invoke("tutor-v2-chat", {
    body: { 
      message: "Explique a fisiopatologia da pré-eclâmpsia de forma profunda.",
      context: { topic: "Obstetrícia" }
    }
  });

  const duration = Date.now() - start;
  if (error) {
    console.log("❌ Tutor IA failed:", error.message);
  } else {
    const content = data?.response || data?.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 100);
    console.log(`✅ Tutor IA responded in ${duration}ms.`);
    console.log(`Content length: ${content.length} chars.`);
    if (content.length < 100) console.log("⚠️ Potential cognitive degradation (too short).");
  }
}

async function run() {
  console.log("🚀 ENAZIZI ENTERPRISE CHAOS TEST INITIATED");
  await testRLS();
  await testCognitiveStability();
  await testConcurrency(20); // 20 simultaneous AI calls
  console.log("\n🏁 CHAOS TEST COMPLETE");
}

run().catch(console.error);
