import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeminiResponse {
  summary: string;
  feynman_summary: string;
  flashcards: Array<{ front: string; back: string }>;
  quiz: Array<{ question: string; options: string[]; answer: string; explanation: string }>;
  questions: Array<{ question: string; answer: string }>;
  video_script: string;
}

serve(async (req) => {
  const startTime = Date.now();
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let contentId: string | null = null;
  let userId: string | null = null;
  let tenantId: string | null = null;

  try {
    const { contentId: cid, isRetry = false } = await req.json()
    contentId = cid;

    // Auth check
    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') ?? '')
    
    if (authError || !user) throw new Error('Não autorizado')
    userId = user.id;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('user_type, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'professor'].includes(profile.user_type)) {
      throw new Error('Acesso restrito a administradores')
    }
    tenantId = profile.organization_id;

    // 1. Fetch content
    const { data: content, error: fetchError } = await supabaseClient
      .from('master_content_library')
      .select('*')
      .eq('id', contentId)
      .single()

    if (fetchError || !content) throw new Error('Conteúdo não encontrado')

    // 2. Cache Logic (Reuse)
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
        await supabaseClient.from('master_content_library').update({
          generated_summary: existingContent.generated_summary,
          generated_feynman: existingContent.generated_feynman,
          generated_flashcards: existingContent.generated_flashcards,
          generated_quiz: existingContent.generated_quiz,
          generated_questions: existingContent.generated_questions,
          generated_video_script: existingContent.generated_video_script,
          status: 'review'
        }).eq('id', contentId)

        await supabaseClient.from('ai_usage_logs').insert({
          tenant_id: tenantId,
          user_id: userId,
          content_id: contentId,
          model: 'cache',
          reused_from_cache: true,
          latency_ms: Date.now() - startTime,
          status: 'success'
        })

        return new Response(JSON.stringify({ success: true, message: "Conteúdo reutilizado do cache." }), { headers: corsHeaders })
      }
    }

    // 3. AI Generation
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada')

    const getSpecialtyInstructions = (discipline: string) => {
      const d = discipline?.toLowerCase() || '';
      if (d.includes('cardio')) return "Siga diretrizes SBC/AHA. Foque em ECG, IC e síndromes coronarianas.";
      if (d.includes('farmaco')) return "Foque em mecanismos de ação, farmacocinética, doses e interações.";
      if (d.includes('cirur')) return "Foque em técnica operatória, indicações e complicações pós-operatórias.";
      if (d.includes('pedia')) return "Considere marcos do desenvolvimento e doses mg/kg.";
      if (d.includes('prev')) return "Foque em SUS, epidemiologia brasileira e PNI.";
      if (d.includes('emerg')) return "Siga ACLS/ATLS. Foque em manejo ABCDE e estabilização.";
      return "Foque nos consensos médicos brasileiros vigentes.";
    }

    const prompt = `
      Você é um especialista em educação médica ENAZIZI.
      Gere material pedagógico para: ${content.discipline} - ${content.topic}.
      Fonte: "${content.raw_content}"

      ${getSpecialtyInstructions(content.discipline)}

      Retorne APENAS um JSON com:
      {
        "summary": "resumo técnico profundo (min 600 palavras)",
        "feynman_summary": "explicação simples",
        "flashcards": [{"front": "", "back": ""}],
        "quiz": [{"question": "", "options": ["A","B","C","D"], "answer": "A", "explanation": ""}],
        "questions": [{"question": "", "answer": ""}],
        "video_script": "roteiro estruturado"
      }
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiData = await response.json()
    if (geminiData.error) throw new Error(geminiData.error.message)

    let aiResponseText = geminiData.candidates[0].content.parts[0].text;
    // Basic cleaning if Markdown markers are present
    aiResponseText = aiResponseText.replace(/```json|```/g, '').trim();

    let parsedData: GeminiResponse;
    let validationStatus: 'valid' | 'repaired' | 'failed' = 'valid';

    try {
      parsedData = JSON.parse(aiResponseText);
      // Basic field validation
      if (!parsedData.summary || !parsedData.flashcards || !parsedData.quiz) throw new Error('Campos obrigatórios ausentes');
    } catch (e) {
      console.log("Falha no JSON, tentando reparo simples...");
      // Simple repair attempt: find first { and last }
      const start = aiResponseText.indexOf('{');
      const end = aiResponseText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try {
          parsedData = JSON.parse(aiResponseText.substring(start, end + 1));
          validationStatus = 'repaired';
        } catch (e2) {
          validationStatus = 'failed';
          throw new Error('JSON Inválido após tentativa de reparo');
        }
      } else {
        validationStatus = 'failed';
        throw new Error('JSON Inválido');
      }
    }

    const inputTokens = content.raw_content.length / 4;
    const outputTokens = aiResponseText.length / 4;
    const estimatedCost = ((inputTokens + outputTokens) / 1000000) * 0.10;

    // 4. Update Library & Logs
    await supabaseClient.from('master_content_library').update({
      generated_summary: parsedData.summary,
      generated_feynman: parsedData.feynman_summary,
      generated_flashcards: parsedData.flashcards,
      generated_quiz: parsedData.quiz,
      generated_questions: parsedData.questions,
      generated_video_script: parsedData.video_script,
      status: 'review'
    }).eq('id', contentId)

    await supabaseClient.from('ai_usage_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      content_id: contentId,
      model: 'gemini-2.0-flash',
      input_tokens: Math.round(inputTokens),
      output_tokens: Math.round(outputTokens),
      estimated_cost: estimatedCost,
      latency_ms: Date.now() - startTime,
      json_validation_status: validationStatus,
      status: 'success'
    })

    return new Response(JSON.stringify({ success: true, message: "Geração concluída com validação JSON." }), { headers: corsHeaders })

  } catch (error) {
    console.error('ERRO PIPELINE:', error.message);
    if (contentId) {
      await supabaseClient.from('master_content_library').update({ status: 'failed', last_error: error.message }).eq('id', contentId)
      await supabaseClient.from('ai_usage_logs').insert({
        tenant_id: tenantId,
        user_id: userId,
        content_id: contentId,
        model: 'gemini-2.0-flash',
        status: 'failed',
        error_message: error.message,
        latency_ms: Date.now() - startTime
      })
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
