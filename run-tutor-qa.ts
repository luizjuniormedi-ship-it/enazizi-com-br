
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runTutorQA } from "./supabase/functions/_shared/tutor-qa-engine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Triggering Tutor QA Runner...");
  
  // Try to find an admin user to attribute the run to
  const { data: users } = await supabase.auth.admin.listUsers();
  const admin = users?.users?.find(u => u.user_metadata?.role === 'admin') || users?.users?.[0];
  
  if (!admin) {
    console.error("No user found to attribute QA run.");
    return;
  }

  try {
    const runId = await runTutorQA(supabase, admin.id);
    console.log(`QA Run successful! ID: ${runId}`);
  } catch (err) {
    console.error("QA Run failed:", err);
  }
}

main();
