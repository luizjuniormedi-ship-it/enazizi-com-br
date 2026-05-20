import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars for test.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testSimuladoGeneration() {
  console.log("🚀 INICIANDO TESTE TRANSACIONAL DE GERAÇÃO DE SIMULADO...");

  const payload = {
    count: 3,
    difficulty: "misto",
    specialty: "Pediatria", // Tema com questões no banco
    topics: ["Pediatria"],
    mode: "estudo",
    saveToBank: true,
    createSession: true
  };

  console.log("1. Chamando question-generator com payload:", JSON.stringify(payload, null, 2));

  try {
    const { data, error } = await supabase.functions.invoke("question-generator", {
      body: payload
    });

    if (error) {
      console.error("❌ ERRO NA CHAMADA DA FUNÇÃO:", error);
      return;
    }

    console.log("2. Resposta recebida:", JSON.stringify(data, null, 2));

    if (data.success && data.session_id) {
      console.log("✅ SUCESSO: Sessão criada com ID:", data.session_id);
      
      // Validar persistência
      console.log("3. Validando persistência em simulado_sessions...");
      const { data: session, error: sessErr } = await supabase
        .from("simulado_sessions")
        .select("*")
        .eq("id", data.session_id)
        .single();

      if (sessErr || !session) {
        console.error("❌ ERRO: Sessão não encontrada no banco!");
      } else {
        console.log("✅ Sessão encontrada no banco:", session.id);
      }

      console.log("4. Validando questões vinculadas em simulado_questions...");
      const { data: qLinks, error: linkErr } = await supabase
        .from("simulado_questions")
        .select("*, questions_bank(statement)")
        .eq("session_id", data.session_id);

      if (linkErr || !qLinks || qLinks.length === 0) {
        console.error("❌ ERRO: Nenhuma questão vinculada encontrada!");
      } else {
        console.log(`✅ ${qLinks.length} questões vinculadas encontradas.`);
        qLinks.forEach((l, i) => {
          console.log(`   [${i+1}] ${l.question_id ? 'Bank Question' : 'AI Snapshot'}`);
        });
      }
    } else {
      console.error("❌ FALHA: success=false ou session_id ausente.");
    }

  } catch (err) {
    console.error("❌ ERRO CRÍTICO NO TESTE:", err);
  }
}

testSimuladoGeneration();
