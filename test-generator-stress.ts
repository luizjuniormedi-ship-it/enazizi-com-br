import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function generateBatch(batchSize: number, specialty: string, topic: string, board?: string) {
  const payload = {
    stream: false,
    outputFormat: "json",
    difficulty: "misto",
    messages: [{
      role: "user",
      content: `Gere ${batchSize} questões de ${topic}${board ? ` da banca ${board}` : ""}.`
    }],
    generationContext: {
      specialty,
      topic,
      objective: "practice",
      source: "simulado",
      board: board || "Geral"
    },
    count: batchSize
  };

  const { data, error } = await supabase.functions.invoke("question-generator", {
    body: payload
  });

  if (error) throw error;
  return data;
}

async function runStressTest() {
  console.log("=== INICIANDO TESTE DE ESTRESSE: GERADOR DE QUESTÕES ===");
  
  // Teste 1: 100 questões (em lotes para evitar timeout de Edge Function)
  console.log("\n[Teste 1] Gerando 100 questões gerais (Lotes de 10)...");
  let totalGenerated = 0;
  for (let i = 1; i <= 10; i++) {
    try {
      process.stdout.write(`Lote ${i}/10... `);
      const data = await generateBatch(10, "Clínica Médica", "Clínica Médica");
      if (data?.questions) {
        totalGenerated += data.questions.length;
        console.log(`OK (${data.questions.length} questões)`);
      } else {
        console.log("Falha: Resposta vazia");
      }
    } catch (e) {
      console.error("\nErro no lote:", e.message);
    }
  }
  console.log(`Total geral gerado: ${totalGenerated}/100`);

  // Teste 2: Por Banca (USP e UNICAMP)
  const bancas = ["USP", "UNICAMP"];
  console.log("\n[Teste 2] Gerando questões por banca específica...");
  for (const banca of bancas) {
    try {
      console.log(`Banca: ${banca}...`);
      const data = await generateBatch(3, "Pediatria", "Aleitamento Materno", banca);
      if (data?.questions) {
        console.log(`  Sucesso: ${data.questions.length} questões geradas para ${banca}`);
        data.questions.forEach((q, idx) => console.log(`  - Q${idx+1}: ${q.statement.substring(0, 50)}...`));
      }
    } catch (e) {
      console.error(`  Erro na banca ${banca}:`, e.message);
    }
  }

  console.log("\n=== TESTE FINALIZADO ===");
}

runStressTest();
