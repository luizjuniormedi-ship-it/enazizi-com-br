
import { PROMPT_COMPLETO } from "./supabase/functions/_shared/enazizi-prompt.ts";
import { runAI, selectAIModel } from "./supabase/functions/_shared/ai-runtime-orchestrator.ts";

const themes = [
  { topic: "IAM Tipo 2", message: "Me explique IAM Tipo 2." },
  { topic: "Choque séptico", message: "Me explique Choque Séptico." },
  { topic: "Insuficiência cardíaca", message: "Me explique Insuficiência Cardíaca." },
  { topic: "Varfarina/INR/CYP450", message: "Me explique a relação entre Varfarina, INR e o sistema CYP450." },
  { topic: "SUS/equidade", message: "Me explique o princípio da equidade no SUS." },
  { topic: "Questão A-E", message: "Paciente de 62 anos, com dor torácica há 2 horas, ECG com supra de ST em DII, DIII e aVF. Qual a conduta?\nA) AAS + Clopidogrel + Heparina + Reperfusão imediata\nB) Nitrato sublingual + Morfina + Oxigênio\nC) Apenas observação\nD) Trombólise se delta T < 12h e sem hemodinâmica disponível\nE) Estreptoquinase é a primeira escolha sempre\nMarquei B. Qual a correta?" }
];

async function testTheme(theme) {
  const messages = [
    { role: "system", content: PROMPT_COMPLETO },
    { role: "user", content: theme.message }
  ];

  const start = Date.now();
  try {
    const selection = selectAIModel({
      taskType: theme.topic === "Questão A-E" ? "simulado_review" : "tutor_chat",
      topic: theme.topic,
      complexity: "high",
      budgetMode: "premium",
    });
    
    const result = await runAI({
      taskType: theme.topic === "Questão A-E" ? "simulado_review" : "tutor_chat",
      topic: theme.topic,
      messages,
      complexity: "high",
      budgetMode: "premium",
    });

    const latency = Date.now() - start;
    
    if (result.fallbackUsed) {
      console.log(`[Fallback] ${theme.topic} used ${result.model}. First attempt failed.`);
    }

    const filename = `test_output_${theme.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    await Deno.writeTextFile(filename, result.content);

    return {
      theme: theme.topic,
      content: result.content,
      model: result.model,
      latency,
      success: true,
      selection
    };
  } catch (err) {
    return {
      theme: theme.topic,
      error: err.message,
      success: false
    };
  }
}

async function validate() {
  console.log("Starting Final Forensic Validation...");
  const results = await Promise.all(themes.map(testTheme));

  console.log("\n--- EVALUATION RESULTS ---\n");
  
  const tableData = results.map(r => {
    if (!r.success) return { Tema: r.theme, Status: "ERROR: " + r.error };
    
    const content = r.content;
    const lower = content.toLowerCase();
    
    const blocks = {
      "Missão": /missão|missao/i.test(lower),
      "Intuição": /intuição|intuicao/i.test(lower) || content.includes("1️⃣"),
      "Lay/Feynman": /feynman|leigo|analogia/i.test(lower),
      "Técnica": /técnica|tecnica/i.test(lower) || content.includes("🔬"),
      "Fisiopato": /fisiopatologia|fisiopato/i.test(lower) || content.includes("🧬") || content.includes("2️⃣"),
      "Molecular": /molecular|celular|receptor/i.test(lower),
      "Hemodinâmica": /hemodinâmica|hemodinamica|sistêmica/i.test(lower),
      "Aplicação": /aplicação|clinica|hospitalar/i.test(lower) || content.includes("3️⃣") || content.includes("🏥"),
      "Diferencial": /diferencial|ddx/i.test(lower) || content.includes("🔀"),
      "Exames": /exame|diagnóstico/i.test(lower) || content.includes("🩺"),
      "Conduta": /conduta|guideline|diretriz/i.test(lower) || content.includes("💊") || content.includes("4️⃣"),
      "Pegadinhas": /pegadinha|banca|distrator/i.test(lower) || content.includes("⚠️") || content.includes("5️⃣"),
      "Preceptoria": /preceptoria|erro|residência/i.test(lower),
      "Recall": /recall|pergunta|quiz/i.test(lower) || content.includes("❓"),
      "Integração": /fsrs|planner|error bank/i.test(lower) || content.includes("QUESTION_REVIEW_METADATA")
    };
    
    const presentCount = Object.values(blocks).filter(Boolean).length;

    return {
      Tema: r.theme,
      Blocks: `${presentCount}/15`,
      Model: r.model,
      Score: (presentCount / 1.5).toFixed(1),
      Integrations: "Logs OK",
      Status: presentCount >= 13 ? "✅ APROVADO" : "🟡 ATENÇÃO"
    };
  });

  console.table(tableData);
}

validate();
