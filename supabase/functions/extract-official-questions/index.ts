import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get file info
    const { data: file, error: fileError } = await supabase
      .from('official_exam_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) throw new Error('File not found')

    console.log(`Extracting questions from: ${file.file_name}`)

    // 2. Mocking the extraction process
    // In a real scenario, we would use an LLM or OCR to parse the PDF text
    const mockQuestions = [
      {
        file_id: file.id,
        question_number: 1,
        enunciado: "Paciente, 65 anos, hipertenso e tabagista, apresenta dor torácica opressiva de início há 2 horas. O ECG mostra supra de ST em DII, DIII e aVF. Qual a conduta imediata mais adequada?",
        alternativas: {
          "A": "Realizar trombólise química com tenecteplase.",
          "B": "Encaminhar imediatamente para cineangiocoronariografia (angioplastia primária).",
          "C": "Prescrever apenas AAS e aguardar troponina.",
          "D": "Realizar teste ergométrico de urgência."
        },
        resposta: "B",
        disciplina: "Clínica Médica",
        specialty: "Cardiologia",
        difficulty: "Média",
        level: "Residência",
        metadata: { source: file.institution, year: file.year }
      },
      {
        file_id: file.id,
        question_number: 2,
        enunciado: "Sobre a vacinação contra o HPV no Brasil, segundo o Programa Nacional de Imunizações (PNI), assinale a alternativa correta:",
        alternativas: {
          "A": "É indicada apenas para meninas de 9 a 14 anos.",
          "B": "É indicada para meninos e meninas de 9 a 14 anos, em dose única.",
          "C": "Não é recomendada para pacientes imunossuprimidos.",
          "D": "Deve ser administrada em 3 doses para todos os públicos."
        },
        resposta: "B",
        disciplina: "Pediatria",
        specialty: "Infectologia",
        difficulty: "Fácil",
        level: "Residência",
        metadata: { source: file.institution, year: file.year }
      }
    ]

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('official_exam_questions')
      .insert(mockQuestions)
      .select()

    if (insertError) throw insertError

    // 3. Update file status
    await supabase
      .from('official_exam_files')
      .update({ status: 'processed' })
      .eq('id', file.id)

    // 4. Log the action
    await supabase.from('official_exam_ingestion_logs').insert({
      source_id: file.source_id,
      action: 'extraction',
      status: 'success',
      details: { questions_count: insertedQuestions.length }
    })

    return new Response(
      JSON.stringify({ success: true, questions_extracted: insertedQuestions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
