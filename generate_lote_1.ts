
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/question-generator`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const areas = [
  "Clínica Médica",
  "Cirurgia Geral",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Medicina Preventiva"
];

async function generateBatch(area: string, count: number) {
  console.log(`[Lote 1] Iniciando geração de ${count} questões para: ${area}`);
  
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      generationContext: {
        specialty: area,
        count: count
      },
      outputFormat: "json",
      difficulty: "misto",
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to generate questions for ${area}: ${await response.text()}`);
  }

  const questions = await response.json();
  console.log(`[Lote 1] Sucesso: ${questions.length} questões geradas para ${area}`);

  // Save to database
  const toInsert = questions.map((q: any) => ({
    statement: q.statement,
    options: q.options,
    correct_index: q.correct_index,
    topic: q.topic || area,
    explanation: q.explanation,
    cognitive_quality_score: q.quality_score || 0.8,
    hallucination_risk_score: q.hallucination_risk || 0.1,
    clinical_reasoning_depth: q.clinical_depth || 3,
    quality_tier: (q.quality_score || 0) > 0.85 ? 'GOLDEN' : 'STANDARD',
    source: 'ENAZIZI_LOTE_1',
    language: 'pt-BR'
  }));

  const { error } = await supabase.from("questions_bank").insert(toInsert);
  if (error) {
    console.error(`[Lote 1] Erro ao inserir questões de ${area}:`, error);
  } else {
    console.log(`[Lote 1] ${toInsert.length} questões inseridas no banco para ${area}`);
  }
}

async function run() {
  const promises = areas.map(area => generateBatch(area, 20));
  await Promise.all(promises);
  console.log("[Lote 1] Ciclo de expansão concluído.");
}

run().catch(console.error);
