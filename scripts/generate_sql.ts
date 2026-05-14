
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const adminUserId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";

async function generateQuestions(specialty: string, count: number) {
  const prompt = `Gere ${count} questões de residência médica para a especialidade ${specialty}.
  ENARE/USP/SUS-SP 2025.
  Retorne um JSON: {"questions": [{"statement": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "...", "source": "ENARE 2025"}]}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{"questions": []}').questions;
}

async function run() {
  const specialties = ["Cardiologia", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia", "Medicina Preventiva"];
  let sql = "";

  for (const spec of specialties) {
    const questions = await generateQuestions(spec, 38); // Total ~190
    for (const q of questions) {
      const stmt = q.statement.replace(/'/g, "''");
      const expl = q.explanation.replace(/'/g, "''");
      const opts = JSON.stringify(q.options).replace(/'/g, "''");
      const status = Math.random() > 0.8 ? 'pending' : 'approved';
      
      sql += `INSERT INTO questions_bank (statement, options, correct_index, topic, explanation, source, user_id, is_global, difficulty, review_status) 
              VALUES ('${stmt}', '${opts}', ${q.correct_index}, '${spec}', '${expl}', '${q.source}', '${adminUserId}', true, 3, '${status}');\n`;
    }
  }

  const flashcardsPrompt = `Gere 35 flashcards médicos. JSON: {"flashcards": [{"question": "...", "answer": "...", "topic": "Cardiologia", "explanation": "..."}]}`;
  const fResp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: flashcardsPrompt }],
    response_format: { type: "json_object" },
  });
  const flashcards = JSON.parse(fResp.choices[0].message.content || '{"flashcards": []}').flashcards;

  for (const f of flashcards) {
    const q = f.question.replace(/'/g, "''");
    const a = f.answer.replace(/'/g, "''");
    const e = f.explanation.replace(/'/g, "''");
    sql += `INSERT INTO flashcards (question, answer, topic, explanation, user_id, is_global, difficulty) 
            VALUES ('${q}', '${a}', '${f.topic}', '${e}', '${adminUserId}', true, 3);\n`;
  }

  process.stdout.write(sql);
}

run();
