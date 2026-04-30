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
    const { contentId, isRetry = false } = await req.json()
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Auth check - Admin only
    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    
    if (authError || !user) {
      throw new Error('Não autorizado')
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('user_type, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'professor'].includes(profile.user_type)) {
      throw new Error('Acesso restrito a administradores')
    }

    // 1. Fetch content from library
    const { data: content, error: fetchError } = await supabaseClient
      .from('master_content_library')
      .select('*')
      .eq('id', contentId)
      .single()

    if (fetchError || !content) {
      throw new Error('Conteúdo não encontrado')
    }

    // Check if already processing or succeeded
    if (content.status === 'processing' && !isRetry) {
      return new Response(JSON.stringify({ message: "Conteúdo já está em processamento" }), { headers: corsHeaders })
    }

    // Hash check for reuse (Skip if explicit retry)
    if (!isRetry && content.content_hash) {
      const { data: existingContent } = await supabaseClient
        .from('master_content_library')
        .select('*')
        .eq('content_hash', content.content_hash)
        .eq('status', 'review')
        .neq('id', contentId)
        .limit(1)
        .maybeSingle()

      if (existingContent) {
        // Reuse content
        await supabaseClient.from('master_content_library').update({
          generated_summary: existingContent.generated_summary,
          generated_feynman: existingContent.generated_feynman,
          generated_flashcards: existingContent.generated_flashcards,
          generated_quiz: existingContent.generated_quiz,
          generated_questions: existingContent.generated_questions,
          generated_video_script: existingContent.generated_video_script,
          status: 'review',
          metadata: { ...content.metadata, reused_from_id: existingContent.id }
        }).eq('id', contentId)

        // Log audit
        await supabaseClient.from('ai_content_audit_logs').insert({
          content_id: contentId,
          user_id: user.id,
          action: 'reused_content',
          new_status: 'review',
          metadata: { source_id: existingContent.id }
        })

        // Log usage (Zero cost)
        await supabaseClient.from('ai_usage_logs').insert({
          tenant_id: profile.organization_id,
          user_id: user.id,
          content_id: contentId,
          model: 'cache',
          reused_from_cache: true,
          estimated_cost: 0
        })

        return new Response(JSON.stringify({ success: true, message: "Conteúdo reutilizado da biblioteca mestre." }), { headers: corsHeaders })
      }
    }

    // 2. Update status to processing
    await supabaseClient
      .from('master_content_library')
      .update({ 
        status: 'processing',
        processing_started_at: new Date().toISOString(),
        retry_count: isRetry ? content.retry_count + 1 : content.retry_count
      })
      .eq('id', contentId)

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada')

    // 3. Construct the prompt
    const prompt = `
      Você é um especialista em educação pedagógica (ENAZIZI médico). 
      Com base no seguinte conteúdo bruto de ${content.discipline || 'uma matéria'} sobre ${content.topic || 'um assunto'}:
      
      "${content.raw_content}"

      Gere os seguintes itens educacionais em formato JSON estrito:
      1. resumo técnico: Um resumo detalhado e profissional.
      2. resumo Feynman: Uma explicação extremamente simples, como se fosse para uma criança.
      3. flashcards: Uma lista de objetos com { "front": "pergunta", "back": "resposta" }.
      4. quiz: Uma lista de 5 questões de múltipla escolha com { "question": "", "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "" }.
      5. questões comentadas: 3 questões dissertativas complexas com resolução comentada.
      6. roteiro de vídeo: Um roteiro para um vídeo curto de 3 minutos.

      Retorne APENAS o JSON no formato solicitado.
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

    if (geminiData.error) {
      const isRateLimit = geminiData.error.code === 429
      const errorMsg = isRateLimit ? 'Rate limit reached' : geminiData.error.message
      
      await supabaseClient.from('master_content_library').update({ 
        status: 'failed',
        last_error: errorMsg
      }).eq('id', contentId)

      await supabaseClient.from('ai_content_audit_logs').insert({
        content_id: contentId,
        user_id: user.id,
        action: 'generation_error',
        error_message: errorMsg,
        metadata: { code: geminiData.error.code }
      })

      throw new Error(errorMsg)
    }

    const aiResponseText = geminiData.candidates[0].content.parts[0].text
    const parsedData = JSON.parse(aiResponseText.replace(/```json|```/g, '').trim())

    // 5. Token usage (Simulated/Estimated for Gemini)
    const inputTokens = content.raw_content.length / 4 // Rough estimate
    const outputTokens = aiResponseText.length / 4
    const costPerMillion = 0.10 // 0.10 USD per 1M tokens approx
    const estimatedCost = ((inputTokens + outputTokens) / 1000000) * costPerMillion

    // 6. Update library
    await supabaseClient
      .from('master_content_library')
      .update({
        generated_summary: parsedData.summary || parsedData.resumo_tecnico,
        generated_feynman: parsedData.feynman_summary || parsedData.resumo_feynman,
        generated_flashcards: parsedData.flashcards,
        generated_quiz: parsedData.quiz,
        generated_questions: parsedData.questions || parsedData.questoes_comentadas,
        generated_video_script: parsedData.video_script || parsedData.roteiro_video,
        status: 'review',
        last_error: null
      })
      .eq('id', contentId)

    // Audit and Usage
    await Promise.all([
      supabaseClient.from('ai_content_audit_logs').insert({
        content_id: contentId,
        user_id: user.id,
        action: 'generation_success',
        new_status: 'review'
      }),
      supabaseClient.from('ai_usage_logs').insert({
        tenant_id: profile.organization_id,
        user_id: user.id,
        content_id: contentId,
        model: 'gemini-2.0-flash',
        input_tokens: Math.round(inputTokens),
        output_tokens: Math.round(outputTokens),
        estimated_cost: estimatedCost
      })
    ])

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
