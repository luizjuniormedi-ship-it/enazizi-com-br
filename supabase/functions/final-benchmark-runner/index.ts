import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { retrieveEvidence, buildEvidenceContextPack, validateGroundedOutput } from '../_shared/evidence-grounding/engine.ts';
import { callNvidia } from '../_shared/nvidia-provider.ts';
import { callCerebras } from '../_shared/cerebras-provider.ts';
import { runAI } from '../_shared/ai-runtime-orchestrator.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MODELS = [
  { provider: 'google', model: 'gemini-2.5-flash' },
  { provider: 'openai', model: 'gpt-5-mini' },
  { provider: 'google', model: 'gemini-2.5-pro' },
  { provider: 'nvidia', model: 'meta/llama-3.1-8b-instruct' },
  { provider: 'cerebras', model: 'gpt-oss-120b' }
];

const TASKS = ['diagnostic_plan', 'treatment_rationale', 'patient_explanation'];

async function callProvider(modelRef: typeof MODELS[0], messages: any[]) {
  const start = Date.now();
  try {
    if (modelRef.provider === 'nvidia') {
      const res = await callNvidia({ model: modelRef.model, messages, maxTokens: 1024 });
      return { content: res.content, status: 200, latency: res.latencyMs, tokens: res.usage.inputTokens + res.usage.outputTokens, effective_model: res.model };
    } else if (modelRef.provider === 'cerebras') {
      const res = await callCerebras({ model: modelRef.model, messages, maxTokens: 1024 });
      return { content: res.content, status: 200, latency: res.latencyMs, tokens: res.usage.inputTokens + res.usage.outputTokens, effective_model: res.model };
    } else {
      const res = await runAI({ 
        taskType: 'clinical_reasoning', 
        messages, 
        budgetMode: 'premium', 
        supabase,
        benchmarkMode: true,
        providerOverride: modelRef.provider as any,
        modelOverride: modelRef.model
      });
      return { content: res.content, status: 200, latency: res.latencyMs, tokens: 0, effective_model: res.model };
    }
  } catch (err: any) {
    return { error: err.message, status: err.httpStatus || 500, latency: Date.now() - start, tokens: 0, effective_model: modelRef.model };
  }
}

Deno.serve(async (req) => {
  const { runId, topicIndex, startTaskIndex, startModelIndex, limit = 5 } = await req.json();
  
  const fallbackTopics = [
    "Infarto Agudo do Miocárdio", "Sepse no Adulto", "Tromboembolismo Pulmonar", 
    "Cetoacidose Diabética", "Hipertensão Arterial Sistêmica", "Insuficiência Cardíaca",
    "Pneumonia Adquirida na Comunidade", "Acidente Vascular Cerebral", "Hemorragia Digestiva Alta",
    "Delirium no Idoso", "Asma Brônquica", "Doença Renal Crônica", 
    "Lúpus Eritematoso Sistêmico", "Artrite Reumatoide", "Hepatite B",
    "Tuberculose Pulmonar", "HIV/AIDS", "Meningite Bacteriana",
    "Pancreatite Aguda", "Colecistite Aguda", "Apendicite Aguda",
    "Câncer de Mama", "Câncer de Próstata", "Depressão Maior",
    "Transtorno de Ansiedade Generalizada", "Esquizofrenia", "Pré-eclâmpsia",
    "Trabalho de Parto Prematuro", "Dengue", "Hanseníase"
  ];

  const results = [];
  let processed = 0;
  
  let currentTopic = topicIndex;
  let currentTask = startTaskIndex;
  let currentModel = startModelIndex;

  while (processed < limit && currentTopic < fallbackTopics.length) {
    const topic = fallbackTopics[currentTopic];
    const evidenceData = await retrieveEvidence(supabase, { topic, useLiveRetrieval: true });
    const contextPack = await buildEvidenceContextPack(runId, topic, evidenceData);

    while (processed < limit && currentTask < TASKS.length) {
      const task = TASKS[currentTask];
      const messages = [
        { role: 'system', content: `Você é o ENAZIZI AI. Use este contexto médico:\n${JSON.stringify(contextPack.evidence)}` },
        { role: 'user', content: `Tarefa: ${task} para o tema ${topic}.` }
      ];

      while (processed < limit && currentModel < MODELS.length) {
        const m = MODELS[currentModel];
        const call = await callProvider(m, messages);
        
        let grounded = { grounding: { grounding_score: 0, unsupported_claim_rate: 1, critical_hallucination: true } };
        if (call.content) {
          grounded = await validateGroundedOutput(call.content, contextPack);
        }

        const res = {
          run_id: runId,
          case_id: topic,
          task,
          provider: m.provider,
          requested_model: m.model,
          effective_model: call.effective_model,
          context_hash: contextPack.contextHash,
          http_status: call.status,
          latency_ms: call.latency,
          grounding_score: grounded.grounding.grounding_score,
          success: !call.error,
          error: call.error
        };

        // Telemetria persistente para auditoria real
        await supabase.from('ai_runtime_logs').insert({
          task_type: 'benchmark',
          request_id: runId,
          provider: m.provider,
          model: m.model,
          success: !call.error,
          latency_ms: call.latency,
          error_code: call.error ? call.error.substring(0, 50) : null,
          metadata: res
        });

        results.push(res);
        processed++;
        currentModel++;
      }

      if (currentModel >= MODELS.length) {
        currentModel = 0;
        currentTask++;
      }
    }

    if (currentTask >= TASKS.length) {
      currentTask = 0;
      currentTopic++;
    }
  }

  return new Response(JSON.stringify({ 
    results,
    next: {
      topicIndex: currentTopic,
      taskIndex: currentTask,
      modelIndex: currentModel,
      done: currentTopic >= fallbackTopics.length
    }
  }), { headers: { "Content-Type": "application/json" } });
});