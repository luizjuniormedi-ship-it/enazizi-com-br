import { createClient } from "@supabase/supabase-js";

const VALID_USER_ID = "095cf92f-427d-48e1-accc-31b357b2fa50"; // ID real do banco para evitar FK violation

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
    count: batchSize,
    forceAi: true,
    bypassAuth: true // NOVO CAMPO PARA TESTE
  };

  const { data, error } = await supabase.functions.invoke("question-generator", {
    body: payload
  });

  if (error) throw error;
  return data;
}

async function runStressTest() {
  console.log("=== INICIANDO TESTE DE ESTRESSE: GERADOR DE QUESTÕES ===");
  
  // Teste 1: 100 questões (em lotes de 20 para ser mais eficiente)
  console.log("\n[Teste 1] Gerando 100 questões gerais (Lotes de 20)...");
  let totalGenerated = 0;
  for (let i = 1; i <= 5; i++) {
    try {
      process.stdout.write(`Lote ${i}/5... `);
      const data = await generateBatch(20, "Clínica Médica", "Clínica Médica");
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
  const bancas = ["USP", "UNICAMP", "ENARE", "SUS-SP"];
  console.log("\n[Teste 2] Gerando questões por banca específica...");
  for (const banca of bancas) {
    try {
      process.stdout.write(`Banca: ${banca}... `);
      const data = await generateBatch(5, "Pediatria", "Imunização", banca);
      if (data?.questions) {
        console.log(`OK (${data.questions.length} questões)`);
      }
    } catch (e) {
      console.error(`\nErro na banca ${banca}:`, e.message);
    }
  }

  console.log("\n=== TESTE FINALIZADO ===");
}

runStressTest();
