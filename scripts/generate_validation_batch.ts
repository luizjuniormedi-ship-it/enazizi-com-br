
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

REGRAS CRÍTICAS DE QUALIDADE (PADRÃO OURO):
1. IDIOMA: TUDO em PORTUGUÊS BRASILEIRO.
2. NÍVEL: ALTO (Residência Médica).
3. ENUNCIADO: Deve ser um CASO CLÍNICO EXTENSO (MÍNIMO 500 CARACTERES).
   - Detalhe história, exame físico completo com sinais vitais e exames.
4. ALTERNATIVAS: 4 opções (A-D).
5. EXPLICAÇÃO: Analise individualmente cada alternativa.

FORMATO JSON:
{
  "questions": [
    {
      "statement": "...",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "topic": "...",
      "explanation": "..."
    }
  ]
}`;

const AREAS = [
  "Clínica Médica",
  "Cirurgia Geral",
  "Pediatria",
  "Ginecologia e Obstetrícia"
];

async function generateForArea(area: string) {
  let attempts = 0;
  while (attempts < 3) {
    console.log(`Gerando 5 questões para: ${area} (Tentativa ${attempts + 1})`);
    const result = await aiFetch({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Gere 5 questões de ${area}. CADA enunciado deve ser um caso clínico de PELO MENOS 500 caracteres.` }
      ]
    });

    const content = JSON.parse(result.choices[0].message.content);
    const questions = content.questions;
    
    // Validate length
    const invalid = questions.filter(q => q.statement.length < 450);
    if (invalid.length === 0) return questions;
    
    console.log(`${invalid.length} questões com tamanho insuficiente. Tentando novamente...`);
    attempts++;
  }
  
  // Fallback: return what we have
  return [];
}

async function main() {
  const allQuestions = [];
  for (const area of AREAS) {
    const questions = await generateForArea(area);
    allQuestions.push(...questions);
  }

  const adminId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";
  const rows = allQuestions.map(q => ({
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

  Deno.writeTextFileSync("validation_batch.json", JSON.stringify(rows, null, 2));
  console.log(`Sucesso! ${rows.length} questões salvas em validation_batch.json`);
}

main();
