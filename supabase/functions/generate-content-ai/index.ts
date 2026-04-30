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
    let cacheStatus = 'cache_miss';
    
    if (!isRetry) {
      // 2.1 Hash Cache
      if (content.content_hash) {
        const { data: hashMatch } = await supabaseClient
          .from('master_content_library')
          .select('*')
          .eq('content_hash', content.content_hash)
          .in('status', ['approved', 'published'])
          .neq('id', contentId)
          .limit(1)
          .maybeSingle()

        if (hashMatch) {
          cacheStatus = 'cache_hit_hash';
          await updateContentFromCache(supabaseClient, contentId, hashMatch);
          await logPromptExecution(supabaseClient, contentId, content, 'gemini-2.0-flash', 0, 0, 0, Date.now() - startTime, 'valid', cacheStatus);
          return new Response(JSON.stringify({ success: true, message: "Cache Hit (Hash)" }), { headers: corsHeaders });
        }
      }

      // 2.2 Semantic/Topic Cache
      const { data: topicMatch } = await supabaseClient
        .from('master_content_library')
        .select('*')
        .eq('discipline', content.discipline)
        .eq('topic', content.topic)
        .in('status', ['approved', 'published'])
        .neq('id', contentId)
        .limit(1)
        .maybeSingle()

      if (topicMatch) {
        cacheStatus = 'cache_hit_topic';
        await updateContentFromCache(supabaseClient, contentId, topicMatch);
        await logPromptExecution(supabaseClient, contentId, content, 'gemini-2.0-flash', 0, 0, 0, Date.now() - startTime, 'valid', cacheStatus);
        return new Response(JSON.stringify({ success: true, message: "Cache Hit (Topic/Semantic)" }), { headers: corsHeaders });
      }
    }

    // 3. AI Generation
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada')

    // Get Active Prompt
    const { data: promptData } = await supabaseClient
      .from('medical_ai_prompts')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single()

    const systemPrompt = promptData?.system_prompt || "Você é um especialista em educação médica ENAZIZI.";
    const getSpecialtyInstructions = (discipline: string) => {
      const d = discipline?.toLowerCase() || '';
      if (d.includes('cardio')) return "Siga diretrizes SBC/AHA. Foque em ECG, IC e síndromes coronarianas.";
      if (d.includes('pedia')) return "Considere marcos do desenvolvimento e doses mg/kg.";
      if (d.includes('emerg')) return "Siga ACLS/ATLS. Foque em manejo ABCDE e estabilização.";
      return "Foque nos consensos médicos brasileiros vigentes.";
    }

    const finalPrompt = `
      ${systemPrompt}
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
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiData = await response.json()
    if (geminiData.error) throw new Error(geminiData.error.message)

    let aiResponseText = geminiData.candidates[0].content.parts[0].text;
    aiResponseText = aiResponseText.replace(/```json|```/g, '').trim();

    let parsedData: GeminiResponse;
    let validationStatus: 'valid' | 'repaired' | 'failed' = 'valid';

    try {
      parsedData = JSON.parse(aiResponseText);
    } catch (e) {
      const start = aiResponseText.indexOf('{');
      const end = aiResponseText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        parsedData = JSON.parse(aiResponseText.substring(start, end + 1));
        validationStatus = 'repaired';
      } else {
        throw new Error('JSON Inválido');
      }
    }

    const inputTokens = Math.round(content.raw_content.length / 4);
    const outputTokens = Math.round(aiResponseText.length / 4);
    const estimatedCost = ((inputTokens + outputTokens) / 1000000) * 0.10;

    // Update Library
    await supabaseClient.from('master_content_library').update({
      generated_summary: parsedData.summary,
      generated_feynman: parsedData.feynman_summary,
      generated_flashcards: parsedData.flashcards,
      generated_quiz: parsedData.quiz,
      generated_questions: parsedData.questions,
      generated_video_script: parsedData.video_script,
      status: 'ai_generated'
    }).eq('id', contentId)

    // Log Execution
    await logPromptExecution(
      supabaseClient, 
      contentId, 
      content, 
      'gemini-2.0-flash', 
      inputTokens, 
      outputTokens, 
      estimatedCost, 
      Date.now() - startTime, 
      validationStatus, 
      'cache_miss',
      promptData?.id,
      promptData?.prompt_version
    );

    return new Response(JSON.stringify({ success: true, message: "Geração concluída." }), { headers: corsHeaders })

  } catch (error) {
    console.error('ERRO PIPELINE:', error.message);
    if (contentId) {
      await supabaseClient.from('master_content_library').update({ status: 'failed', last_error: error.message }).eq('id', contentId)
      await logPromptExecution(supabaseClient, contentId, null, 'gemini-2.0-flash', 0, 0, 0, Date.now() - startTime, 'failed', 'cache_miss', null, null, error.message);
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})

async function updateContentFromCache(supabaseClient: any, contentId: string, sourceContent: any) {
  await supabaseClient.from('master_content_library').update({
    generated_summary: sourceContent.generated_summary,
    generated_feynman: sourceContent.generated_feynman,
    generated_flashcards: sourceContent.generated_flashcards,
    generated_quiz: sourceContent.generated_quiz,
    generated_questions: sourceContent.generated_questions,
    generated_video_script: sourceContent.generated_video_script,
    status: 'ai_generated' // Move to review queue even if cached
  }).eq('id', contentId)
}

async function logPromptExecution(
  supabaseClient: any, 
  contentId: string, 
  content: any, 
  model: string, 
  inputTokens: number, 
  outputTokens: number, 
  cost: number, 
  latency: number, 
  validation: string, 
  cacheStatus: string,
  promptId?: string,
  promptVersion?: string,
  error?: string
) {
  await supabaseClient.from('medical_prompt_execution_logs').insert({
    content_id: contentId,
    prompt_id: promptId,
    prompt_version: promptVersion,
    specialty: content?.discipline,
    model: model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latency,
    estimated_cost: cost,
    json_validation_status: validation,
    cache_status: cacheStatus,
    status: error ? 'failed' : 'success',
    error_message: error
  })
}
