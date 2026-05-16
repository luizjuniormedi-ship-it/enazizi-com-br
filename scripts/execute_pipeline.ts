
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const adminUserId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";

async function generateQuestions(specialty: string, count: number) {
  console.log(`Generating ${count} questions for ${specialty}...`);
  const prompt = `Você é um especialista em educação médica. Gere ${count} questões de altíssima qualidade (padrão ouro) para residência médica brasileira (ENARE, USP, UNICAMP, SUS-SP 2025).
  
  Especialidade: ${specialty}
  Regras:
  1. Use Casos Clínicos realistas (mínimo 450 caracteres).
  2. Inclua dados de exame físico, sinais vitais e labs.
  3. Exatamente 4 alternativas (A-D).
  4. Explicação detalhada analisando cada alternativa.
  5. Mini-revisão do tema e referência bibliográfica (Diretrizes 2024/2025).
  6. Idioma: Português Brasileiro.
  
  Retorne APENAS um JSON no formato:
  {
    "questions": [
      {
        "statement": "...",
        "options": ["...", "...", "...", "..."],
        "correct_index": 0,
        "explanation": "...",
        "source": "ENARE 2025"
      }
    ]
  }`;

  try {
    const response = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const data = JSON.parse(response.choices[0].message.content || '{"questions": []}');
    return data.questions.map((q: any) => ({
      ...q,
      topic: specialty,
      user_id: adminUserId,
      is_global: true,
      difficulty: 3 + Math.floor(Math.random() * 2), // 3 or 4
      review_status: Math.random() > 0.8 ? "pending" : "approved" // Most approved, some pending for testing
    }));
  } catch (err) {
    console.error(`Error generating for ${specialty}:`, err);
    return [];
  }
}

async function generateFlashcards(count: number) {
  console.log(`Generating ${count} flashcards...`);
  const prompt = `Gere ${count} flashcards médicos de alto rendimento.
  Regras:
  1. Caso clínico curto seguido de pergunta.
  2. Resposta direta.
  3. Explicação curta.
  
  Formato JSON:
  {
    "flashcards": [
      {
        "question": "Caso: ... Pergunta: ...",
        "answer": "...",
        "topic": "Cardiologia",
        "explanation": "..."
      }
    ]
  }`;

  try {
    const response = await openai.chat.completions.create({
      model: "openai/gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const data = JSON.parse(response.choices[0].message.content || '{"flashcards": []}');
    return data.flashcards.map((f: any) => ({
      ...f,
      user_id: adminUserId,
      is_global: true,
      difficulty: 3
    }));
  } catch (err) {
    console.error(`Error generating flashcards:`, err);
    return [];
  }
}

async function run() {
  const specialties = ["Cardiologia", "Cirurgia", "Pediatria", "Ginecologia e Obstetrícia", "Medicina Preventiva"];
  let totalInserted = 0;

  for (const spec of specialties) {
    const questions = await generateQuestions(spec, 40);
    if (questions.length === 0) continue;
    
    const { error } = await supabase.from('questions_bank').insert(questions);
    if (error) console.error(`Error in ${spec}:`, error);
    else {
      totalInserted += questions.length;
      console.log(`Inserted ${questions.length} questions for ${spec}.`);
    }
  }

  const flashcards = await generateFlashcards(35);
  if (flashcards.length > 0) {
    const { error: fError } = await supabase.from('flashcards').insert(flashcards);
    if (fError) console.error("Error in flashcards:", fError);
    else console.log(`Inserted ${flashcards.length} flashcards.`);
  }

  console.log(`Pipeline finished. Total questions: ${totalInserted}.`);
}

run();
