import React from 'react';

export default function EG3Foundation() {
  const content = `WAR ROOM — FINAL BENCHMARK RECOVERY
PHASE A — DATASET FREEZE + VALID PROVIDERS EXECUTION

OBJETIVO

Preservar a validade científica do FINAL REAL AI ROUTING BENCHMARK enquanto os providers Google/OpenAI são regularizados.

NÃO retomar a execução indiscriminada das 450 chamadas.

Executar duas trilhas independentes:

TRACK A
Freeze definitivo do benchmark dataset.

TRACK B
Execução real apenas dos providers atualmente válidos:
- NVIDIA meta/llama-3.1-8b-instruct
- Cerebras gpt-oss-120b

Em paralelo, diagnosticar Google/OpenAI sem usar fallback.

==================================================
1 — FREEZE DO DATASET
==================================================

Construir definitivamente os 30 casos clínicos.

Para cada caso gerar uma única vez:

Canonical Topic
Evidence Retrieval
Internal Corpus
GOLD
Official Exams
Guidelines
PubMed
Content pack metadata

Criar os três tasks:

QUESTION_GENERATION
TUTOR
CLINICAL_SIMULATION

Resultado esperado:

30 casos
x
3 tasks

= 90 benchmark units.

Cada unit deve possuir:

benchmark_dataset_version
case_id
task_id
context_pack_id
context_hash
canonical_topic
evidence_ids
PMIDs
PMCIDs
gold_question_ids
official_exam_refs
retrieval_timestamp

Definir:

benchmark_dataset_version =
FINAL_ROUTING_V1

Depois do freeze:

NÃO executar novo retrieval individual por provider.

Todos os providers atuais ou futuros deverão usar exatamente esses mesmos 90 context_hashes.

==================================================
2 — DATASET IMMUTABILITY
==================================================

Depois de congelado:

context_hash não pode mudar.

Se qualquer EvidenceContextPack mudar:

BENCHMARK_DATASET_MUTATION

e bloquear comparação.

Criar checksum global do dataset:

dataset_hash

Todos os providers devem informar:

dataset_version = FINAL_ROUTING_V1
dataset_hash = SAME

==================================================
3 — EXECUTAR NVIDIA
==================================================

Executar:

90 primary executions

Provider:
NVIDIA

Requested:
meta/llama-3.1-8b-instruct

Require:

requested_model == effective_model

Sem cross-provider fallback.

Medir todos os hard gates EG-3.

==================================================
4 — EXECUTAR CEREBRAS
==================================================

Executar:

90 primary executions

Provider:
Cerebras

Requested:
gpt-oss-120b

Require:

requested_model == effective_model

Contrato:

content present
→ COMPLETE

content empty + reasoning present
→ INCOMPLETE_GENERATION

Nunca:

reasoning → final answer.

Retry controlado é permitido.

Fallback para outro provider:

PROIBIDO PARA SCORE.

==================================================
5 — EXECUTION COUNT
==================================================

Ao final desta fase exigir:

NVIDIA primary executions .... 90
Cerebras primary executions .. 90

Total primary real ........... 180

Retries devem ser contados separadamente.

==================================================
6 — GOOGLE ACCESS DIAGNOSTIC
==================================================

NÃO usar fallback.

Diagnosticar separadamente:

gemini-2.5-flash
gemini-2.5-pro

Descobrir:

client utilizado
endpoint
credential source
project
requested model
original HTTP
original error
gateway involved?
fallback involved?
quota source
quota scope

Verificar se a chamada está passando por:

Lovable AI Gateway
ou
Google provider direto.

Não revelar secrets.

Retornar somente metadata segura.

Se existir capacidade de consulta do catálogo de modelos com a credencial atual:

listar somente os IDs de modelos disponíveis.

Não inventar disponibilidade.

==================================================
7 — OPENAI ACCESS DIAGNOSTIC
==================================================

NÃO usar fallback.

Diagnosticar:

requested:
gpt-5-mini

Retornar:

endpoint
organization/project context se disponível sem segredo
requested model
original HTTP
original error
model visible in available model catalogue?
alias involved?
gateway involved?
fallback involved?

Se gpt-5-mini NÃO estiver disponível na credencial atual:

NÃO mapear para GPT-4o.

Listar quais modelos OpenAI estão REALMENTE acessíveis à credencial de benchmark.

A substituição de candidato requer decisão explícita posterior.

==================================================
8 — NÃO ALTERAR ROTEAMENTO PRODUTIVO
==================================================

Nenhuma dessas ações pode modificar:

Tutor
Simulado
Question Generator
Plantão
Flashcards
Planner
Production Router
Feature Flags
Landing
Dashboard
RLS

==================================================
9 — GROUNDING HARD GATES
==================================================

Para NVIDIA e Cerebras:

Grounding < 0.90
→ FAIL

Unsupported Claim Rate > 0.05
→ FAIL

Critical Hallucination > 0
→ FAIL

Unsupported Answer Key
→ FAIL

Exact Topic failure
→ FAIL

Sibling contamination relevante
→ FAIL

Evidence conflict crítico ignorado
→ FAIL

==================================================
10 — RESULTADO PARCIAL
==================================================

Gerar:

WAR ROOM — FINAL BENCHMARK RECOVERY

Dataset
--------------------------------
Version ................ FINAL_ROUTING_V1
Cases .................. 30
Tasks .................. 90
Dataset frozen ......... YES/NO
Dataset hash ........... <hash>
Context hashes frozen .. 90/90

NVIDIA
--------------------------------
Primary executions ..... ?/90
Effective identity ..... PASS/FAIL
Success rate ........... ?
Hard-gate pass ......... ?
Grounding .............. ?
Unsupported claims ..... ?
Critical hallucinations ?
Topic fidelity ......... ?
Answer key support ..... ?
p50 .................... ?
p95 .................... ?
429 .................... ?
5xx .................... ?

Cerebras
--------------------------------
Primary executions ..... ?/90
Effective identity ..... PASS/FAIL
Success rate ........... ?
Hard-gate pass ......... ?
Grounding .............. ?
Unsupported claims ..... ?
Critical hallucinations ?
Topic fidelity ......... ?
Answer key support ..... ?
p50 .................... ?
p95 .................... ?
Incomplete generation .. ?
Retries ................. ?

Google Diagnostic
--------------------------------
Gemini Flash ........... AVAILABLE/BLOCKED
Gemini Pro ............. AVAILABLE/BLOCKED
Root cause ............. ?
Gateway ................ DIRECT/INTERMEDIATE
Required correction .... ?

OpenAI Diagnostic
--------------------------------
GPT-5 Mini ............. AVAILABLE/UNAVAILABLE
Root cause ............. ?
Gateway ................ DIRECT/INTERMEDIATE
Accessible models ...... [...]

==================================================
CERTIFICATION
==================================================

NÃO declarar FINAL BENCHMARK CERTIFIED.

Nesta fase o status máximo é:

PARTIAL REAL BENCHMARK COMPLETE
WAITING FOR GOOGLE/OPENAI

Somente depois que todos os candidatos aprovados forem executados contra FINAL_ROUTING_V1 será possível produzir o ranking final.

==================================================
REGRA FINAL
==================================================

Não mudar o EvidenceContextPack depois do freeze.

Isso é essencial.

Quando Google/OpenAI forem regularizados, deverão competir exatamente contra os mesmos context_hashes já utilizados por NVIDIA e Cerebras.`;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 overflow-auto selection:bg-green-500 selection:text-black">
      <div className="max-w-4xl mx-auto border border-green-900/30 p-8 bg-green-950/5 shadow-[0_0_50px_rgba(0,255,0,0.05)]">
        <div className="flex justify-between items-center mb-12 border-b border-green-900/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            <h1 className="text-2xl font-bold tracking-tighter">ENAZIZI WAR ROOM</h1>
          </div>
          <div className="text-xs opacity-50 space-x-4">
            <span>EG-3 STABILIZATION</span>
            <span>2026-08-11</span>
            <span>SYSTEM: ALERT</span>
          </div>
        </div>
        
        <pre className="whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
          {content}
        </pre>
        
        <div className="mt-12 pt-6 border-t border-green-900/30 text-[10px] opacity-30 flex justify-between">
          <span>SECURE PROTOCOL V4.1.2</span>
          <span>UNAUTHORIZED ACCESS PROHIBITED</span>
        </div>
      </div>
    </div>
  );
}
