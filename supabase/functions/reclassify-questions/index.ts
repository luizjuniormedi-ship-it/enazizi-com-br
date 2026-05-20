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
    const { data: questions, error: fetchError } = await supabase
      .from("real_exam_questions")
      .select("id, statement, options, source_file, topic, subtopic, correct_index")
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

    console.log("Calling Gemini for classification...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      const content = aiData.choices[0].message.content;
      const parsed = JSON.parse(content);
      classifications = Array.isArray(parsed) ? parsed : (parsed.classifications || parsed.results || []);
    } catch (e) {
      console.error("Failed to parse AI response:", aiData);
      throw new Error("Invalid JSON from AI");
    }

    const now = new Date().toISOString();
    const results = [];

    // Processar atualizações e geração de flashcards
    const processPromises = classifications.map(async (item: any) => {
      console.log(`Processing question ${item.id}`);
      
      // Update real_exam_questions
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
        return null;
      }

      // Update questions_bank
      await supabase
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

      // Generate flashcard
      const q = questions.find(question => question.id === item.id);
      if (q) {
        try {
          const fcResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Você é um especialista em medicina." },
                { role: "user", content: `Com base nesta questão médica, crie um flashcard (pergunta e resposta curta) para estudo.\nQuestão: ${q.statement}\nResposta correta index: ${q.correct_index}\nRetorne JSON: {"question": "...", "answer": "...", "explanation": "..."}` }
              ],
              response_format: { type: "json_object" }
            }),
          });

          if (fcResponse.ok) {
            const fcData = await fcResponse.json();
            const fcContent = JSON.parse(fcData.choices[0].message.content);
            
            await supabase
              .from("flashcards")
              .insert({
                user_id: "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023",
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
          }
        } catch (e) {
          console.error(`Flashcard generation failed for ${item.id}:`, e);
        }
      }

      return { id: item.id, topic: item.topic, subtopic: item.subtopic };
    });

    const processedResults = await Promise.all(processPromises);
    const validResults = processedResults.filter(r => r !== null);

    return new Response(JSON.stringify({ 
      processed: validResults.length, 
      results: validResults,
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
