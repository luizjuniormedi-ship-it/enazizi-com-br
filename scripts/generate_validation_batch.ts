
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
      model: "gpt-4o",
      messages: body.messages,
      response_format: { type: "json_object" },
    }),
  });
  return response.json();
}

const SYSTEM_PROMPT = `Você é um gerador de questões de ELITE absoluta para Residência Médica brasileira (ENARE, USP, UNIFESP, Revalida, Santa Casa, SUS-SP).

REGRAS CRÍTICAS DE QUALIDADE (PADRÃO OURO):
1. IDIOMA: TUDO em PORTUGUÊS BRASILEIRO. NUNCA use inglês.
2. NÍVEL: ALTO (Residência Médica). Evite conceitos triviais.
3. ENUNCIADO (statement): Deve ser um CASO CLÍNICO COMPLETO, EXTENSO e REALISTA.
   - Nome fictício, idade EXATA, sexo, profissão/ocupação.
   - Queixa principal com tempo de evolução preciso.
   - Antecedentes pessoais detalhados (medicações, cirurgias, hábitos).
   - EXAME FÍSICO DETALHADO: PA, FC, FR, Temp, SpO2 (sempre com valores numéricos).
   - EXAMES COMPLEMENTARES: Apresentar resultados com valores de referência e unidades.
   - OBRIGATÓRIO: Mínimo 500 caracteres para o enunciado. Se for menor, adicione mais detalhes clínicos.
   - Termine sempre com a pergunta direta.
4. ALTERNATIVAS: Exatamente 4 opções (A-D) plausíveis.
5. EXPLICAÇÃO (explanation): Analise individualmente cada alternativa (por que correta/errada).
   - Inclua "🧑‍⚕️ Explicação Simplificada" ao final.
   - 📚 Mini-revisão do tema (3-5 linhas).
   - Cite referência bibliográfica atualizada (Harrison 21ed, Sabiston 21ed, Williams 26ed, Nelson 21ed).

FORMATO JSON:
{
  "questions": [
    {
      "statement": "...",
      "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "correct_index": 0,
      "topic": "Especialidade - Subtema",
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
  console.log(`Gerando 5 questões para: ${area}`);
  const result = await aiFetch({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Gere 5 questões inéditas e de alto nível de ${area}. Varie os subtemas entre os mais cobrados em provas de residência. GARANTA que cada enunciado clínico tenha pelo menos 500 caracteres de texto rico em detalhes médicos.` }
    ]
  });

  const content = JSON.parse(result.choices[0].message.content);
  return content.questions;
}

async function main() {
  const allQuestions = [];
  for (const area of AREAS) {
    try {
      const questions = await generateForArea(area);
      allQuestions.push(...questions);
    } catch (e) {
      console.error(`Erro ao gerar para ${area}:`, e);
    }
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
  console.log("Arquivo validation_batch.json gerado com sucesso.");
}

main();
