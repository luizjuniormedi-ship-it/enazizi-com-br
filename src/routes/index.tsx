import React from 'react';

export default function EG3UnifiedRouter() {
  const content = `WAR ROOM — EG-3 UNIFIED EVIDENCE-GROUNDED AI ROUTER

OBJETIVO

Transformar a infraestrutura certificada EG-1/EG-2 em uma arquitetura única de IA para todos os módulos clínicos e acadêmicos do ENAZIZI.

IMPORTANTE:

EG-3 NÃO deve substituir a Evidence Layer.

A arquitetura definitiva é:

MODULE
↓
Canonical Topic Engine
↓
Unified Medical Evidence Service
↓
Evidence Context Pack
↓
Unified AI Router
↓
Provider
↓
Grounding Validator
↓
Clinical Consistency Guard
↓
Exact Topic Guard
↓
OUTPUT

==================================================
P0 — CORRIGIR REGRESSÃO DA HOME
==================================================

Antes de qualquer alteração:

verificar a rota pública \`/\`.

Se \`/\` estiver exibindo:

WAR ROOM
EG-2 benchmark
dashboard técnico
telemetria administrativa

RESTORE imediatamente a Landing Page pública certificada.

War Room deve permanecer somente em rota administrativa, por exemplo:

/admin/production-observation
/admin/scientific-audit
ou rota administrativa equivalente já existente.

NÃO criar nova home técnica.

Critério:

/ ........................ LANDING
/admin/... ............... WAR ROOM

==================================================
REGRA ABSOLUTA
==================================================

Nenhum módulo clínico deve chamar diretamente:

Gemini
OpenAI
NVIDIA
Cerebras
Claude

O módulo deve chamar:

groundedAIRouter()

ou abstraction equivalente única.

==================================================
EVIDENCE FIRST
==================================================

Antes de qualquer geração médica:

buildMedicalEvidenceContext()

deve produzir:

context_pack_id
context_hash
canonical_topic
evidence[]
conflicts[]
retrieval_confidence
freshness

O provider recebe esse contexto.

LLM MEMORY != MEDICAL EVIDENCE.

==================================================
PUBMED / LITERATURA
==================================================

Integrar o Unified Medical Evidence Service preparado na EG-3 Evidence Service.

Fontes:

diretrizes oficiais
literatura validada
PubMed
PMC quando disponível
corpus ENAZIZI
provas oficiais
GOLD
banco validado

Não pesquisar PubMed desnecessariamente em cada interação.

Usar:

L1 cache
↓
L2 corpus interno
↓
L3 PubMed/PMC live retrieval

==================================================
ROUTER
==================================================

Criar/normalizar:

groundedAIRouter({
  module,
  taskType,
  evidenceContext,
  requiredCapabilities,
  latencyClass,
  outputContract
})

O router NÃO pode executar retrieval diferente para cada provider.

==================================================
PROVIDERS INICIAIS
==================================================

Com base nos benchmarks já medidos:

DEFAULT CLINICAL
google/gemini-2.5-flash

FALLBACK
openai/gpt-5-mini

DEEP REASONING
google/gemini-2.5-pro

FAST
nvidia/meta-llama-3.1-8b-instruct

EXPERIMENTAL / SHADOW
cerebras/gpt-oss-120b

SHADOW ONLY
nvidia/meta-llama-3.3-70b-instruct

DEGRADED / QUARANTINED
Claude Gateway

IMPORTANTE:

Não promover Cerebras automaticamente apenas pelos healthchecks.

==================================================
ROUTING POR CAPABILITY
==================================================

QUESTION_GENERATION
Gemini Flash
→ GPT-5 Mini
→ NVIDIA 8B

TUTOR
Gemini Flash
→ GPT-5 Mini
→ NVIDIA 8B

CLINICAL_SIMULATION
Gemini Flash
→ GPT-5 Mini

QUESTION_EXPLANATION
Gemini Flash
→ GPT-5 Mini

FLASHCARDS
Gemini Flash
→ NVIDIA 8B
→ GPT-5 Mini

MNEMONICS
NVIDIA 8B
→ Gemini Flash

PLANNER MEDICAL CONTENT
NVIDIA 8B
→ Gemini Flash

DEEP_REASONING
Gemini Pro
→ GPT-5 Mini

VISION
manter provider multimodal certificado existente.

Não usar modelo text-only para substituir Vision.

==================================================
MÓDULOS A MIGRAR
==================================================

Mapear chamadas diretas de IA existentes em:

Tutor V3
Professor Simulado
Question Generator
Adaptive Simulado
Question Explainer
Flashcards
Recovery
Mnemônicos
Clinical Simulation
Planner
Process Upload/RAG
demais funções clínicas

Gerar primeiro:

AI_CALL_INVENTORY

contendo:

module
file
current provider
current model
current gateway
fallback
grounding present?
migration status

Nenhuma chamada escondida deve permanecer sem inventário.

==================================================
MIGRAÇÃO EM WAVES
==================================================

Não fazer big-bang migration.

WAVE 1
Question Generator
Question Explainer

WAVE 2
Tutor

WAVE 3
Flashcards
Recovery
Mnemônicos

WAVE 4
Adaptive Simulado
Professor Simulado

WAVE 5
Clinical Simulation

WAVE 6
Planner / demais módulos acadêmicos

Cada wave:

SHADOW
→ CONTRACT TEST
→ CANARY
→ OBSERVE
→ PROMOTE

==================================================
CANARY
==================================================

Inicialmente:

0% mudança automática de produção.

Depois dos contract tests:

5% canary

Se saudável:

10%
25%
50%
100%

Cada estágio exige gate explícito.

==================================================
ROLLBACK
==================================================

Cada módulo deve possuir rollback imediato para o provider/fluxo anterior durante a migração.

Não remover implementação anterior antes da certificação.

==================================================
HARD GATES CLÍNICOS
==================================================

Grounding Score < 0.90
→ REJECT

Critical Hallucination > 0
→ REJECT

Unsupported Claim Rate > 0.05
→ REJECT

Answer Key unsupported
→ REJECT

Exact Topic failure
→ REJECT

Sibling contamination
→ REJECT

Evidence conflict crítico não tratado
→ REJECT

==================================================
CEREBRAS
==================================================

Nunca:

reasoning → final answer

Contrato:

content presente
→ COMPLETE

content vazio + reasoning
→ INCOMPLETE_GENERATION

content vazio + reasoning vazio
→ EMPTY_GENERATION

Retry com budget adequado.

Depois fallback.

==================================================
RESILIÊNCIA
==================================================

Implementar por provider:

timeout
retry policy
exponential backoff
circuit breaker
health state

Estados:

HEALTHY
DEGRADED
OPEN
RECOVERING

429 deve respeitar backoff.

5xx repetido deve abrir circuit breaker.

==================================================
OBSERVABILIDADE
==================================================

Toda chamada deve registrar:

trace_id
module
task_type
provider
model
context_pack_id
context_hash
grounding_score
topic_match_score
latency_ms
http_status
input_tokens
output_tokens
retry_count
fallback_used
circuit_state
success

Nunca registrar:

API keys
JWT
reasoning privado
dados sensíveis desnecessários

==================================================
TESTES OBRIGATÓRIOS
==================================================

Executar contract tests para cada módulo migrado.

Casos clínicos mínimos:

IAM
Sepse
TEP
CAD pediátrica
Bronquiolite

IAM:

allowed:
IAM
STEMI
NSTEMI
SCA

blocked contamination:
Pericardite
Miocardite
IC

==================================================
CRITÉRIOS DE ACEITE
==================================================

Landing pública restaurada ........ PASS
AI Call Inventory ................. PASS
Evidence-first enforcement ........ PASS
Unified Router .................... PASS
Provider abstraction .............. PASS
PubMed/Evidence integration ....... PASS
Grounding gates ................... PASS
Exact Topic ....................... PASS
Fallback .......................... PASS
Circuit Breaker ................... PASS
Telemetry ......................... PASS
Rollback .......................... PASS

Nenhuma wave pode ser promovida se algum gate crítico falhar.

==================================================
NÃO FAZER
==================================================

Não alterar banco GOLD.

Não persistir benchmark como questão real.

Não promover Cerebras automaticamente.

Não reativar Claude Gateway quebrado.

Não usar NVIDIA 70B em produção.

Não colocar War Room na home.

Não permitir chamada clínica direta ao provider depois da migração do módulo.

Não afirmar validação científica/eficácia clínica apenas com métricas heurísticas.

==================================================
RELATÓRIO FINAL
==================================================

WAR ROOM — EG-3 UNIFIED ROUTER

Public Landing .................... PASS/FAIL
AI Calls inventoried .............. X/X
Modules grounded .................. X/X
Direct clinical AI calls remaining X

Unified Router .................... PASS/FAIL
Evidence Service .................. PASS/FAIL
PubMed/PMC ......................... PASS/FAIL
Grounding Guard ................... PASS/FAIL
Exact Topic Guard ................. PASS/FAIL
Fallback Engine ................... PASS/FAIL
Circuit Breaker ................... PASS/FAIL
Telemetry ......................... PASS/FAIL
Rollback .......................... PASS/FAIL

WAVE 1 ............................ READY/NOT READY
WAVE 2 ............................ READY/NOT READY
WAVE 3 ............................ READY/NOT READY
WAVE 4 ............................ READY/NOT READY
WAVE 5 ............................ READY/NOT READY
WAVE 6 ............................ READY/NOT READY

Production routing changed ........ NO
until explicit canary authorization.

FINAL DECISION:

EG-3 FOUNDATION CERTIFIED
READY FOR WAVE 1 CANARY

ou

EG-3 NOT CERTIFIED

com root cause precisa.`;

  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen whitespace-pre-wrap">
      {content}
    </div>
  );
}
