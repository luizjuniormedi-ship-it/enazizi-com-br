import { PROMPT_COMPLETO } from "./supabase/functions/_shared/enazizi-prompt.ts";

async function validateTopic(topic: string) {
  console.log(`\n=== VALIDANDO TÓPICO: ${topic} ===`);
  
  const gatewayKey = process.env.LOVABLE_API_KEY || process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    console.error("LOVABLE_API_KEY não encontrada.");
    return;
  }

  const messages = [
    { role: "system", content: PROMPT_COMPLETO },
    { role: "user", content: `Olá, quero aprender sobre ${topic}.` }
  ];

  try {
    const response = await fetch("https://api.lovable.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gatewayKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-5", // ou o modelo que você preferir testar
        messages: messages,
        temperature: 0.7
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("--- RESPOSTA DO TUTOR ---");
    console.log(content);
    console.log("--------------------------");
    
    // Verificações básicas
    const checks = {
      "Caso Clínico Vivo": /paciente|anos|chega|apresenta/i.test(content),
      "Pergunta Socrática": /\?/.test(content),
      "Analogia Visual": /imagine|como se|pense/i.test(content),
      "Fisiopatologia": /fisiopatologia|mecanismo|por que/i.test(content),
      "Blocos Enazizi": /BLOCO/i.test(content) || /##/i.test(content)
    };
    
    console.log("VERIFICAÇÕES:", checks);
  } catch (error) {
    console.error(`Erro ao validar ${topic}:`, error);
  }
}

async function main() {
  await validateTopic("TEP (Tromboembolismo Pulmonar)");
  await validateTopic("IAM (Infarto Agudo do Miocárdio)");
  await validateTopic("Sepse");
}

main();
