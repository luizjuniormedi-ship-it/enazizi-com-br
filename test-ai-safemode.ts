import { aiFetch } from "./supabase/functions/_shared/ai-fetch.ts";

async function testAi() {
  console.log("Testing aiFetch in Safe Mode...");
  try {
    const response = await aiFetch({
      model: "gpt-5-mini", // Testing if this works on gateway
      messages: [
        { role: "system", content: "Você é um professor de medicina." },
        { role: "user", content: "Crie 1 questão médica sobre IAM (Infarto Agudo do Miocárdio) em JSON." }
      ]
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response Content:", data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testAi();
