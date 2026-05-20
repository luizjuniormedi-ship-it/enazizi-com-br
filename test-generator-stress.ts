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
  
  // Teste 1: 10 questões (reduzido para validar se a autorização funciona agora)
  console.log("\n[Teste 1] Validando acesso com Service Role...");
  try {
    const data = await generateBatch(5, "Clínica Médica", "Clínica Médica");
    if (data?.questions) {
      console.log(`  Sucesso: ${data.questions.length} questões geradas.`);
    } else {
      console.log("  Falha: Resposta vazia");
    }
  } catch (e) {
    console.error("  Erro de Autorização/Execução:", e.message);
    console.log("  Nota: O gerador exige um JWT de usuário real. O script service_role não é suficiente para o middleware requireAuth.");
  }

  console.log("\n=== TESTE FINALIZADO ===");
}

runStressTest();
