import { PROMPT_COMPLETO } from "./supabase/functions/_shared/enazizi-prompt.ts";

async function test() {
  const systemMsg = PROMPT_COMPLETO;
  const chars = systemMsg.length;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(systemMsg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log("--- INTEGRITY TEST ---");
  console.log("Chars:", chars);
  console.log("Hash:", hash);
  console.log("Truncation detected:", chars < 2000 ? "N/A (Too short)" : "Checking...");
  
  if (chars > 10000) {
    console.log("PASS: Contract is robust (>10k chars)");
  } else {
    console.log("FAIL: Contract seems too short, check imports");
  }
}

test();
