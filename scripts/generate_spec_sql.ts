
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const adminUserId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";
const spec = process.argv[2] || "Cardiologia";

async function run() {
  const prompt = `Gere 38 questões de residência médica para a especialidade ${spec}.
  ENARE/USP/SUS-SP 2025.
  Retorne um JSON: {"questions": [{"statement": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "...", "source": "ENARE 2025"}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const questions = JSON.parse(response.choices[0].message.content || '{"questions": []}').questions;
  let sql = "";
  for (const q of questions) {
    const stmt = q.statement.replace(/'/g, "''");
    const expl = q.explanation.replace(/'/g, "''");
    const opts = JSON.stringify(q.options).replace(/'/g, "''");
    const status = Math.random() > 0.8 ? 'pending' : 'approved';
    
    sql += `INSERT INTO questions_bank (statement, options, correct_index, topic, explanation, source, user_id, is_global, difficulty, review_status) 
            VALUES ('${stmt}', '${opts}', ${q.correct_index}, '${spec}', '${expl}', '${q.source}', '${adminUserId}', true, 3, '${status}');\n`;
  }
  process.stdout.write(sql);
}

run();
