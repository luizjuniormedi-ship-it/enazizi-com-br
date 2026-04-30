import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { contentId } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch content from library
    const { data: content, error: fetchError } = await supabaseClient
      .from('master_content_library')
      .select('*')
      .eq('id', contentId)
      .single()

    if (fetchError || !content) {
      throw new Error('Conteúdo não encontrado')
    }

    // 2. Update status to processing
    await supabaseClient
      .from('master_content_library')
      .update({ status: 'processing' })
      .eq('id', contentId)

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada')
    }

    // 3. Construct the prompt for Gemini 2.0 Flash
    const prompt = `
      Você é um especialista em educação pedagógica. 
      Com base no seguinte conteúdo bruto de ${content.discipline || 'uma matéria'} sobre ${content.topic || 'um assunto'}:
      
      "${content.raw_content}"

      Gere os seguintes itens educacionais em formato JSON estrito:
      1. resumo técnico: Um resumo detalhado e profissional.
      2. resumo Feynman: Uma explicação extremamente simples, como se fosse para uma criança.
      3. flashcards: Uma lista de objetos com { "front": "pergunta", "back": "resposta" }.
      4. quiz: Uma lista de 5 questões de múltipla escolha com { "question": "", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "" }.
      5. questões comentadas: 3 questões dissertativas complexas com resolução comentada.
      6. roteiro de vídeo: Um roteiro para um vídeo curto de 3 minutos.

      Retorne APENAS o JSON no formato:
      {
        "summary": "...",
        "feynman_summary": "...",
        "flashcards": [...],
        "quiz": [...],
        "questions": [...],
        "video_script": "..."
      }
    `;

    // 4. Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiData = await response.json()
    console.log('Gemini raw response:', JSON.stringify(geminiData))

    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('Gemini não retornou candidatos válidos. Verifique a API Key e o conteúdo.')
    }

    const aiResponseText = geminiData.candidates[0].content.parts[0].text
    // Clean up potential markdown code blocks if the model included them
    const cleanJson = aiResponseText.replace(/```json|```/g, '').trim()
    const parsedData = JSON.parse(cleanJson)

    // 5. Update library with generated content
    const { error: updateError } = await supabaseClient
      .from('master_content_library')
      .update({
        generated_summary: parsedData.summary || parsedData.resumo_tecnico,
        generated_feynman: parsedData.feynman_summary || parsedData.resumo_feynman,
        generated_flashcards: parsedData.flashcards,
        generated_quiz: parsedData.quiz,
        generated_questions: parsedData.questions || parsedData.questoes_comentadas,
        generated_video_script: parsedData.video_script || parsedData.roteiro_video,
        status: 'review'
      })
      .eq('id', contentId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, message: "Conteúdo gerado com IA. Revisão pedagógica obrigatória." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na generate-content-ai:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
