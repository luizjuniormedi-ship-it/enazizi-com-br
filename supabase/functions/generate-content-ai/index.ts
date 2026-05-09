import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIContentResponse {
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
    // Auth check (before reading body or invoking IA)
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const user = { id: auth.userId };
    userId = user.id;

    const { contentId: cid, isRetry = false } = await req.json()
    contentId = cid;

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
          await supabaseClient.rpc('log_ai_alert', { 
            p_type: 'cache_hit', 
            p_severity: 'info', 
            p_message: `Cache Hit (Hash) para ${content.title}`,
            p_content_id: contentId,
            p_metadata: { source_id: hashMatch.id, type: 'hash' }
          });
          await logPromptExecution(supabaseClient, contentId, content, 'openai/gpt-5-mini', 0, 0, 0, Date.now() - startTime, 'valid', cacheStatus);
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
        await supabaseClient.rpc('log_ai_alert', { 
          p_type: 'cache_hit', 
          p_severity: 'info', 
          p_message: `Cache Hit (Tópico) para ${content.title}`,
          p_content_id: contentId,
          p_metadata: { source_id: topicMatch.id, type: 'topic' }
        });
        await logPromptExecution(supabaseClient, contentId, content, 'openai/gpt-5-mini', 0, 0, 0, Date.now() - startTime, 'valid', cacheStatus);
        return new Response(JSON.stringify({ success: true, message: "Cache Hit (Topic/Semantic)" }), { headers: corsHeaders });
      }
    }

    // 3. AI Generation
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada')

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
      if (d.includes('cardio')) return "Siga diretrizes SBC/AHA. Foque em raciocínio clínico para provas.";
      if (d.includes('pedia')) return "Considere marcos do desenvolvimento e bibliografia Nelson.";
      if (d.includes('emerg')) return "Siga ACLS/ATLS. Foque em condutas de emergência para residência.";
      return "Foque nos consensos educacionais e bibliografias de referência para residência médica.";
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
        "video_script": "roteiro estruturado de aula",
        "notebooklm_package": {
           "title": "${content.title}",
           "objectives": ["Objetivo 1", "Objetivo 2"],
           "points_of_exam": ["Ponto 1", "Ponto 2"],
           "audio_script": "Roteiro narrativo para Audio Overview"
        }
      }
    `;

    let response;
    let retries = 3;
    const model = 'openai/gpt-5-mini';
    
    while (retries > 0) {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: finalPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      
      if (response.status === 429) {
        retries--;
        await supabaseClient.rpc('log_ai_alert', { 
          p_type: 'rate_limit_429', 
          p_severity: 'warning', 
          p_message: `Rate limit 429 atingido. Tentativa ${3-retries+1}`,
          p_content_id: contentId
        });
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      break;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway Error ${response.status}: ${errorText}`);
    }

    const aiData = await response.json();
    const aiResponseText = aiData.choices[0].message.content;
    let parsedData: any;
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
        await supabaseClient.rpc('log_ai_alert', { 
          p_type: 'json_failure', 
          p_severity: 'critical', 
          p_message: `Falha crítica ao parsear JSON do OpenAI para ${content.title}`,
          p_content_id: contentId,
          p_metadata: { raw_text: aiResponseText.substring(0, 500) }
        });
        throw new Error('JSON Inválido');
      }
    }

    const inputTokens = Math.round(content.raw_content.length / 4);
    const outputTokens = Math.round(aiResponseText.length / 4);
    const estimatedCost = ((inputTokens + outputTokens) / 1000000) * 0.10;

    // Structured NotebookLM text
    const notebookLMText = `
# ENAZIZI MÉDICO -> NOTEBOOKLM EXPORT
Título: ${content.title}
Disciplina: ${content.discipline}

## OBJETIVOS
${parsedData.notebooklm_package?.objectives?.join('\n') || ''}

## RESUMO TÉCNICO
${parsedData.summary}

## PONTOS DE PROVA
${parsedData.notebooklm_package?.points_of_exam?.join('\n') || ''}

## ROTEIRO DE ÁUDIO
${parsedData.notebooklm_package?.audio_script || parsedData.video_script}
    `.trim();

    // Update Library
    await supabaseClient.from('master_content_library').update({
      generated_summary: parsedData.summary,
      generated_feynman: parsedData.feynman_summary,
      generated_flashcards: parsedData.flashcards,
      generated_quiz: parsedData.quiz,
      generated_questions: parsedData.questions,
      generated_video_script: parsedData.video_script,
      notebooklm_export_text: notebookLMText,
      status: 'ai_generated'
    }).eq('id', contentId)

    // Log Execution
    await logPromptExecution(
      supabaseClient, 
      contentId, 
      content, 
      'openai/gpt-5-mini', 
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
      await supabaseClient.rpc('log_ai_alert', { 
        p_type: 'openai_error', 
        p_severity: 'critical', 
        p_message: `Erro na pipeline IA: ${error.message}`,
        p_content_id: contentId
      });
      await logPromptExecution(supabaseClient, contentId, null, 'openai/gpt-5-mini', 0, 0, 0, Date.now() - startTime, 'failed', 'cache_miss', null, null, error.message);
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
