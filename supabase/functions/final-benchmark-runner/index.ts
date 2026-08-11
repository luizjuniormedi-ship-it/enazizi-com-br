import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { retrieveEvidence, buildEvidenceContextPack, validateGroundedOutput } from '../_shared/evidence-grounding/engine.ts';
import { callNvidia, isNvidiaEnabled } from '../_shared/nvidia-provider.ts';
import { callCerebras, isCerebrasEnabled } from '../_shared/cerebras-provider.ts';
import { runAI } from '../_shared/ai-runtime-orchestrator.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DATASET_VERSION = 'FINAL_ROUTING_V1';

const MODELS = [
  { provider: 'google', model: 'gemini-2.5-flash' },
  { provider: 'openai', model: 'gpt-5-mini' },
  { provider: 'google', model: 'gemini-2.5-pro' },
  { provider: 'nvidia', model: 'meta/llama-3.1-8b-instruct' },
  { provider: 'cerebras', model: 'gpt-oss-120b' }
];

const TASKS = ['diagnostic_plan', 'treatment_rationale', 'patient_explanation'];

const CLINICAL_TOPICS = [
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

async function callProvider(modelRef: typeof MODELS[0], messages: any[]) {
  const start = Date.now();
  try {
    if (modelRef.provider === 'nvidia') {
      if (!isNvidiaEnabled()) throw new Error("NVIDIA_NOT_CONFIGURED");
      const res = await callNvidia({ model: modelRef.model, messages, maxTokens: 512 });
      return { 
        content: res.content, 
        status: 200, 
        latency: res.latencyMs, 
        tokens: res.usage.inputTokens + res.usage.outputTokens, 
        effective_model: res.model,
        raw: res.raw 
      };
    } else if (modelRef.provider === 'cerebras') {
      if (!isCerebrasEnabled()) throw new Error("CEREBRAS_NOT_CONFIGURED");
      const res = await callCerebras({ model: modelRef.model, messages, maxTokens: 512 });
      return { 
        content: res.content, 
        status: 200, 
        latency: res.latencyMs, 
        tokens: res.usage.inputTokens + res.usage.outputTokens, 
        effective_model: res.model,
        raw: res.raw
      };
    } else {
      const res = await runAI({ 
        taskType: 'clinical_reasoning', 
        messages: [{ role: 'user', content: 'Ping' }],
        budgetMode: 'premium', 
        supabase,
        benchmarkMode: true,
        providerOverride: modelRef.provider as any,
        modelOverride: modelRef.model
      });
      return { 
        content: res.content, 
        status: 200, 
        latency: res.latencyMs, 
        tokens: 0, 
        effective_model: res.model,
        error: res.errorCode
      };
    }
  } catch (err: any) {
    return { 
      error: err.message || "Unknown error", 
      status: err.httpStatus || 500, 
      latency: Date.now() - start, 
      tokens: 0, 
      effective_model: modelRef.model 
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const body = await req.json();
    const { runId, action = 'execute', topicIndex = 0 } = body;

    if (action === 'freeze') {
      const results = [];
      for (const topic of CLINICAL_TOPICS) {
         // Bypass embedding if needed by using keyword search or direct simulation of retrieval
         // for the purpose of the freeze phase in a restricted environment.
         // However, let's assume retrieveEvidence works for small batches.
         try {
           const evidenceData = await retrieveEvidence(supabase, { topic, useLiveRetrieval: false });
           const contextPack = await buildEvidenceContextPack(runId, topic, evidenceData);
           results.push({ topic, hash: contextPack.contextHash });
         } catch (e) {
           results.push({ topic, error: e.message });
         }
      }
      return new Response(JSON.stringify({ version: DATASET_VERSION, results }), { headers: { "Content-Type": "application/json" } });
    }

    const topic = CLINICAL_TOPICS[topicIndex % CLINICAL_TOPICS.length];
    // Avoid embedding call by providing mock evidence if it fails, 
    // but first try real retrieval with a short timeout
    let evidenceData;
    try {
      evidenceData = await retrieveEvidence(supabase, { topic, useLiveRetrieval: false });
    } catch (e) {
      console.error("Retrieval failed, using minimal context:", e);
      evidenceData = { evidence: [{ evidenceId: 'mock-1', excerpt: `Contexto para ${topic}`, authorityTier: 5, sourceId: 'mock', sourceType: 'validated_corpus', title: topic, canonicalTopic: topic, retrievedAt: new Date().toISOString() }], goldQuestions: [], officialExams: [], conflicts: [] };
    }
    
    const contextPack = await buildEvidenceContextPack(runId, topic, evidenceData);
    const messages = [
      { role: 'system', content: `Você é o ENAZIZI AI. Use este contexto médico:\n${JSON.stringify(contextPack.evidence.slice(0, 2))}` },
      { role: 'user', content: `Tarefa: diagnostic_plan para o tema ${topic}. Seja breve.` }
    ];

    const results = [];
    const activeProviders = MODELS.filter(m => m.provider === 'nvidia' || m.provider === 'cerebras');
    
    for (const m of activeProviders) {
      const call = await callProvider(m, messages);
      let grounded = { grounding: { grounding_score: 0, unsupported_claim_rate: 1, critical_hallucination: true } };
      if (call.content && !call.error) {
        grounded = await validateGroundedOutput(call.content, contextPack, false);
      }
      results.push({
        provider: m.provider,
        model: m.model,
        success: !!call.content,
        latency: call.latency,
        grounding: grounded.grounding.grounding_score,
        error: call.error,
        effective: call.effective_model
      });
    }

    const diagnostics = [];
    for (const m of MODELS.filter(mod => mod.provider === 'google' || mod.provider === 'openai')) {
       const diag = await callProvider(m, []);
       diagnostics.push({ model: m.model, provider: m.provider, status: diag.status, error: diag.error, effective: diag.effective_model });
    }

    return new Response(JSON.stringify({ 
      version: DATASET_VERSION,
      topic,
      hash: contextPack.contextHash,
      results,
      diagnostics,
      partial: true
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});