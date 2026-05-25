import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiFetch } from "../_shared/ai-fetch.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { getDocument } from "https://esm.sh/pdfjs-serverless";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function extractPdfTextFromUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) return "";
    const data = new Uint8Array(await resp.arrayBuffer());
    const document = await getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str || "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(text);
    }
    return pages.join("\n\n");
  } catch (err) {
    console.error("PDF Extraction error:", err);
    return "";
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileId } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: file, error: fileError } = await supabase
      .from('official_exam_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !file) throw new Error('File not found');

    console.log(`[Extraction] Processing real exam: ${file.file_name}`);

    let textToProcess = file.extracted_text || "";

    if (!textToProcess && file.file_url) {
      console.log(`[Extraction] No text found, attempting PDF extraction from: ${file.file_url}`);
      textToProcess = await extractPdfTextFromUrl(file.file_url);
    }

    if (!textToProcess) {
      throw new Error("Não foi possível extrair texto do PDF. O arquivo pode ser apenas imagem ou estar protegido.");
    }

    const systemPrompt = `Você é um ESPECIALISTA EM EXTRAÇÃO MÉDICA.
Sua missão é extrair questões estruturadas de textos de provas de residência.

REGRAS:
1. Extraia o enunciado, alternativas (A, B, C, D, E se houver), gabarito, disciplina e especialidade.
2. Identifique o SUBTÓPICO específico.
3. Retorne JSON puro no formato:
{
  "questions": [
    {
      "question_number": 1,
      "enunciado": "...",
      "alternativas": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "resposta": "A",
      "disciplina": "...",
      "specialty": "...",
      "sub_topic": "...",
      "difficulty": "Média/Alta",
      "level": "Residência"
    }
  ]
}`;

    const aiResponse = await aiFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extraia as questões do seguinte texto da prova ${file.file_name} (${file.institution} ${file.year}):\n\n${textToProcess.slice(0, 15000)}` }
      ],
      response_format: { type: "json_object" }
    });

    if (!aiResponse.ok) throw new Error(`AI service error: ${aiResponse.status}`);
    
    const aiData = await aiResponse.json();
    const parsed = parseAiJson(aiData.choices[0].message.content);
    const questions = parsed.questions || [];

    if (questions.length === 0) {
      throw new Error("Nenhuma questão foi identificada pela IA no conteúdo do PDF.");
    }

    console.log(`[Extraction] Found ${questions.length} real questions`);

    const questionsToInsert = questions.map((q: any) => ({
      file_id: file.id,
      question_number: q.question_number,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      resposta: q.resposta,
      disciplina: q.disciplina,
      specialty: q.specialty,
      sub_topic: q.sub_topic,
      difficulty: q.difficulty,
      level: q.level,
      metadata: { ...q.metadata, source: file.institution, year: file.year, ai_extracted: true }
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('official_exam_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) throw insertError;

    await supabase
      .from('official_exam_files')
      .update({ status: 'processed', extracted_text: textToProcess.slice(0, 10000) })
      .eq('id', file.id);

    await supabase.from('official_exam_ingestion_logs').insert({
      source_id: file.source_id,
      action: 'extraction',
      status: 'success',
      details: { questions_count: insertedQuestions.length, model: "google/gemini-2.5-flash" }
    });

    return new Response(
      JSON.stringify({ success: true, questions_extracted: insertedQuestions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[Extraction Error] ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});