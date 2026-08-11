import { PROMPT_COMPLETO } from "./supabase/functions/_shared/enazizi-prompt.ts";
import { TUTOR_IA_PREMIUM } from "./supabase/functions/_shared/premium-motors.ts";

async function test() {
  const systemMsg = PROMPT_COMPLETO;
  const chars = systemMsg.length;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(systemMsg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log("--- TUTOR V3 POST-RESTORE CERTIFICATION ---");
  console.log("Contract Integrity Report:");
  console.log(`- Total Chars (PROMPT_COMPLETO): ${chars}`);
  console.log(`- Contract Hash: ${hash}`);
  console.log(`- TUTOR_IA_PREMIUM length: ${TUTOR_IA_PREMIUM.length}`);
  
  if (chars > 2000) {
    console.log("PASS: Arbitrary truncation check (No slice(0, 2000) detected).");
  } else {
    console.log("FAIL: Contract is under 2000 chars.");
  }

  // Verificação de Presença dos Blocos nos MOTORS
  const blocks = [
    "1. Missão Clínica", "2. Roadmap Cognitivo", "3. Explicação Leiga", "4. Fisiopatologia Profunda",
    "5. Raciocínio Clínico", "6. Quadro Clínico e Diagnóstico", "7. Conduta e Tratamento", "8. Pegadinhas de Prova",
    "9. Mapa de Decisão", "10. Questão Guiada", "11. Correção Comentada", "12. Active Recall",
    "13. Flashcards", "14. Resumo Ultraobjetivo", "15. Modo Preceptor"
  ];
  
  let found = 0;
  blocks.forEach(b => {
    if (TUTOR_IA_PREMIUM.includes(b)) found++;
  });

  console.log(`- Blocks Reachable: ${found}/15`);
  
  const hasPtBr = systemMsg.includes("português do Brasil") || systemMsg.includes("Mentor Médico");
  console.log(`- Language Contract: ${hasPtBr ? "PASS (pt-BR enforced)" : "FAIL"}`);

  console.log("==========================================");
  if (found === 15 && chars > 5000 && hasPtBr) {
      console.log("FINAL STATUS: TUTOR V3 PEDAGOGICAL CONTRACT CERTIFIED");
  } else {
      console.log("FINAL STATUS: TUTOR V3 RESTORE INCOMPLETE");
  }
}

test();
