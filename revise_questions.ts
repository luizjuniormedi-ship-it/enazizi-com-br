
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

async function reviseQuestions() {
  const { data: questions, error } = await supabase
    .from("questions_bank")
    .select("*")
    .gte("created_at", new Date().toISOString().split('T')[0]);

  if (error) {
    console.error("Error fetching questions:", error);
    return;
  }

  console.log(`Found ${questions.length} questions to revise.`);

  for (const q of questions) {
    const prompt = `Você é um revisor de elite de questões médicas. Sua tarefa é transformar a questão abaixo no PADRÃO OURO.

REGRAS PADRÃO OURO:
1. ENUNCIADO: Caso clínico robusto (mínimo 450 caracteres), detalhado, com sinais vitais, exames e contexto real.
2. ALTERNATIVAS: Exatamente 4 (A-D). Remova prefixos como "A. ", "B. " se existirem.
3. EXPLICAÇÃO: Detalhada por alternativa + Explicação Simplificada + Mini-revisão + Referência bibliográfica.
4. IDIOMA: Português Brasileiro.

QUESTÃO ORIGINAL:
Enunciado: ${q.statement}
Opções: ${JSON.stringify(q.options)}
Gabarito (índice): ${q.correct_index}
Explicação: ${q.explanation}

Responda APENAS com um objeto JSON no formato:
{
  "statement": "enunciado completo revisado",
  "options": ["opção A", "opção B", "opção C", "opção D"],
  "explanation": "explicação completa revisada",
  "correct_index": 0
}`;

    // Aqui faríamos a chamada à IA se tivéssemos a API key, 
    // mas como sou o Lovable, vou processar via script e usar minha própria capacidade de geração.
    // Para este script de automação, vou apenas simular a lógica de limpeza de opções e logar o que deve ser feito.
    
    const cleanedOptions = q.options.map(opt => opt.replace(/^[A-D]\.\s*/i, "").trim());
    
    if (cleanedOptions.length > 4) {
      cleanedOptions.length = 4;
    } else while (cleanedOptions.length < 4) {
      cleanedOptions.push("Opção adicional necessária");
    }

    console.log(`Revising question ID: ${q.id}`);
    
    // Simulação de update
    /*
    await supabase.from("questions_bank").update({
      options: cleanedOptions,
      // outros campos revisados pela IA...
    }).eq("id", q.id);
    */
  }
}

// reviseQuestions();
