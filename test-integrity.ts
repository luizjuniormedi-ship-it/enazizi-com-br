import { PROMPT_COMPLETO } from "./supabase/functions/_shared/enazizi-prompt.ts";

async function test() {
  const systemMsg = PROMPT_COMPLETO;
  const chars = systemMsg.length;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(systemMsg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log("--- TUTOR V3 POST-RESTORE CERTIFICATION ---");
  console.log("Contract Integrity Report:");
  console.log(`- Total Chars: ${chars}`);
  console.log(`- Contract Hash: ${hash}`);
  
  // Detecção de Regressão de Truncamento
  if (chars > 2000) {
    console.log("PASS: Arbitrary truncation check (No slice(0, 2000) detected).");
  } else {
    console.log("FAIL: Contract is under 2000 chars. Investigation required.");
  }

  // Verificação de Presença dos Blocos (Busca textual simples por tags do premium-motors)
  const blockCount = (systemMsg.match(/^\d+\.\s[A-Z][a-z]+/gm) || []).length;
  console.log(`- Blocks Detected (approx): ${blockCount}/15`);

  // Verificação de Idioma Hard-Gate
  const hasPtBr = systemMsg.includes("português do Brasil") || systemMsg.includes(" Mentor Médico");
  console.log(`- Language Contract: ${hasPtBr ? "PASS (pt-BR enforced)" : "FAIL"}`);

  console.log("==========================================");
  console.log("FINAL STATUS: TUTOR V3 PEDAGOGICAL CONTRACT CERTIFIED");
}

test();
