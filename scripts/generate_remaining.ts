
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

async function aiFetch(body: any) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-5",
      messages: body.messages,
      response_format: { type: "json_object" },
    }),
  });
  return response.json();
}

const SYSTEM_PROMPT = `Você é um gerador de questões de ELITE absoluta para Residência Médica brasileira.
MÍNIMO 500 CARACTERES NO ENUNCIADO.`;

async function main() {
  console.log("Gerando as 5 questões restantes de GO...");
  const result = await aiFetch({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "Gere 5 questões de Ginecologia e Obstetrícia. CADA enunciado deve ser um caso clínico extenso de PELO MENOS 500 caracteres, com detalhes de história e exame físico. Formato JSON: { \"questions\": [ { \"statement\": \"...\", \"options\": [\"A\",\"B\",\"C\",\"D\"], \"correct_index\": 0, \"topic\": \"...\", \"explanation\": \"...\" } ] }" }
    ]
  });

  const content = JSON.parse(result.choices[0].message.content);
  const questions = content.questions;

  const adminId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";
  const rows = questions.map(q => ({
    user_id: adminId,
    statement: q.statement,
    options: q.options,
    correct_index: q.correct_index,
    explanation: q.explanation,
    topic: q.topic,
    is_global: true,
    review_status: "approved",
    quality_tier: "exam_standard"
  }));

  Deno.writeTextFileSync("validation_batch_2.json", JSON.stringify(rows, null, 2));
}

main();
