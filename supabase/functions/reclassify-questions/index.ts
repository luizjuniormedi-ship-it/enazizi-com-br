import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // 1. Busca questões da tabela real_exam_questions que ainda não foram classificadas corretamente
    // Prioriza questões que têm source_file e que ainda não têm classified_at
    const { data: questions, error: fetchError } = await supabase
      .from("real_exam_questions")
      .select("id, statement, options, source_file, topic, subtopic")
      .is("classified_at", null)
      .not("source_file", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ message: "No questions to classify", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionsList = questions.map((q, idx) => `
ID: ${q.id}
Arquivo: ${q.source_file || 'N/A'}
Enunciado: ${q.statement}
Opções: ${JSON.stringify(q.options)}
`).join("\n---");

    const prompt = `Classifique cada questao medica abaixo nos campos:
- topic: especialidade principal (usar EXATAMENTE uma destas: Clinica Medica, Cirurgia Geral, Pediatria, Ginecologia e Obstetricia, Medicina Preventiva, Cardiologia, Pneumologia, Gastroenterologia, Nefrologia, Endocrinologia, Neurologia, Infectologia, Reumatologia, Hematologia, Dermatologia, Ortopedia, Urologia, Oftalmologia, Otorrinolaringologia, Psiquiatria, Medicina de Emergencia, Terapia Intensiva)
- subtopic: subtema especifico (ex: ICC, DPOC, Pneumonia, Diabetes, Sepse, Apendicite, Pre-eclampsia, etc)
- tags: array de 3-5 palavras-chave para busca
- difficulty: 1-5 baseado na complexidade real
- clinical_case: true/false se tem caso clinico no enunciado
- board: banca de origem (identificar pelo nome do arquivo fonte ou conteudo)
- year: ano da prova (extrair do nome do arquivo ou conteudo)

Retorne JSON no formato: [{"id": "uuid", "topic": "...", "subtopic": "...", "tags": [...], "difficulty": N, "clinical_case": bool, "board": "...", "year": N}]

Questoes:
${questionsList}`;

    console.log("Calling Gemini via Lovable AI Gateway...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: "Você é um especialista em educação médica e classificação de questões de residência." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let classifications;
    try {
      // Handle different possible response structures from the gateway
      const content = aiData.choices[0].message.content;
      const parsed = JSON.parse(content);
      classifications = Array.isArray(parsed) ? parsed : (parsed.classifications || parsed.results || []);
    } catch (e) {
      console.error("Failed to parse AI response:", aiData);
      throw new Error("Invalid JSON from AI");
    }

    const results = [];
    const now = new Date().toISOString();

    for (const item of classifications) {
      console.log(`Processing classification for question ${item.id}`);
      
      // 3. Atualiza cada questao no banco com os novos campos
      const { error: updateError } = await supabase
        .from("real_exam_questions")
        .update({
          topic: item.topic,
          subtopic: item.subtopic,
          tags: item.tags,
          difficulty: item.difficulty,
          is_clinical_case: item.clinical_case,
          board: item.board,
          year: item.year,
          classified_at: now
        })
        .eq("id", item.id);

      if (updateError) {
        console.error(`Error updating real_exam_questions for ${item.id}:`, updateError);
        continue;
      }

      // 4. Apos classificar em real_exam_questions, TAMBEM atualiza a mesma questao em questions_bank (se existir)
      const { error: bankError } = await supabase
        .from("questions_bank")
        .update({
          topic: item.topic,
          subtopic: item.subtopic,
          tags: item.tags,
          difficulty: item.difficulty,
          is_clinical_case: item.clinical_case,
          board: item.board,
          year: item.year,
          classified_at: now
        })
        .eq("original_question_id", item.id);

      if (bankError) {
        console.log(`Note: No corresponding entry in questions_bank for ${item.id} or error occurred:`, bankError.message);
      }

      // 5. Para cada questao classificada, gera 1 flashcard focado no tema
      // Buscamos o enunciado para gerar o flashcard
      const q = questions.find(question => question.id === item.id);
      if (q) {
        const flashcardPrompt = `Com base nesta questão médica, crie um flashcard (pergunta e resposta curta) para estudo.
Questão: ${q.statement}
Resposta correta index: ${q.correct_index}

Retorne JSON: {"question": "...", "answer": "...", "explanation": "..."}`;

        const fcResponse = await fetch("https://api.lovable.dev/v1/ai/chat", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash",
            messages: [
              { role: "system", content: "Você é um especialista em medicina." },
              { role: "user", content: flashcardPrompt }
            ],
            response_format: { type: "json_object" }
          }),
        });

        if (fcResponse.ok) {
          const fcData = await fcResponse.json();
          const fcContent = JSON.parse(fcData.choices[0].message.content);
          
          const { error: fcInsertError } = await supabase
            .from("flashcards")
            .insert({
              question: fcContent.question,
              answer: fcContent.answer,
              explanation: fcContent.explanation,
              topic: item.topic,
              subtopic: item.subtopic,
              difficulty: item.difficulty,
              is_global: true,
              generation_method: "reclassify-pipeline",
              metadata: { original_question_id: item.id }
            });
            
          if (fcInsertError) {
            console.error(`Error inserting flashcard for ${item.id}:`, fcInsertError);
          }
        }
      }

      results.push({ id: item.id, topic: item.topic, subtopic: item.subtopic });
    }

    return new Response(JSON.stringify({ 
      processed: results.length, 
      results,
      timestamp: now
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in reclassify-questions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
