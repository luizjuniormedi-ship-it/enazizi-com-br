
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = "https://qszsyskumcmuknumwxtk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDUwNjUsImV4cCI6MjA4NjIyMTA2NX0.B2Si8zb8YJcDhIsyj6edriyXsG3p2rP-NLrGfBFAoZw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConcurrency(count: number) {
  console.log(`Starting concurrency test with ${count} parallel calls...`);
  const start = Date.now();
  
  const promises = Array.from({ length: count }).map(async (_, i) => {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
      body: { prompt: "Say hello", model: "openai/gpt-4o-mini" }
    });
    return { id: i, ok: !error, error: error?.message };
  });

  const results = await Promise.all(promises);
  const duration = Date.now() - start;
  
  const success = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  
  console.log(`Concurrency Test Results:`);
  console.log(`- Total: ${count}`);
  console.log(`- Success: ${success}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Duration: ${duration}ms`);
  console.log(`- Avg: ${duration / count}ms per call`);
  
  if (failed > 0) {
    console.log("Errors encountered:", results.filter(r => !r.ok).map(r => r.error));
  }
}

async function testRLS() {
  console.log("Testing RLS Security...");
  
  // Attempt to read profiles with anon key
  const { data, error } = await supabase.from("profiles").select("*").limit(1);
  
  if (error) {
    console.log("RLS Check: profiles table correctly protected or threw error:", error.message);
  } else {
    console.log("RLS Check: Profiles table accessible via anon key (Check if this is intended - public profiles?)");
  }

  // Attempt to read official_exam_files (should be admin only)
  const { data: exams, error: examErr } = await supabase.from("official_exam_files").select("*").limit(1);
  if (examErr) {
    console.log("RLS Check: official_exam_files protected:", examErr.message);
  } else if (exams && exams.length > 0) {
    console.log("CRITICAL: official_exam_files accessible via anon key!");
  } else {
    console.log("RLS Check: official_exam_files returned empty/protected.");
  }
}

async function run() {
  await testRLS();
  await testConcurrency(10); // Start with 10 to be safe
}

run().catch(console.error);
