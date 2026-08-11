import React from 'react';
// P0 TUTOR PEDAGOGICAL CONTRACT RESTORED

export default function EG3Foundation() {
  const content = `WAR ROOM — AI PERFORMANCE RECOVERY V2
TUTOR CONTRACT LOCK + LOW-LATENCY RUNTIME

PRIORIDADE: P0 PERFORMANCE
MODO: MEASURE → OPTIMIZE → TEST → CERTIFY

==================================================
CONTEXTO CERTIFICADO — NÃO ALTERAR
==================================================

O Tutor IA V3 teve seu contrato pedagógico restaurado e certificado.

Baseline obrigatório:

Tutor master prompt ............ 6008 caracteres
Strategic blocks ............... 15/15
Transport integrity ............ PASS
SHA-256 ........................ 56331016...
Default language ............... pt-BR
Arbitrary system truncation .... REMOVED
Pedagogical contract ........... CERTIFIED

IMPORTANTE:

O hash acima está abreviado no relatório disponível.

Antes de qualquer alteração, obtenha do código/teste de certificação
o SHA-256 COMPLETO do contrato e use o valor completo como baseline.

NÃO inventar o restante do hash.

==================================================
OBJETIVO
==================================================

Reduzir drasticamente a latência:

Tutor IA
Plantão
Question Generator
Simulados
Correções
Flashcards
Mnemônicos
Planner
ENAFLIX
Professor
demais módulos de IA

SEM:

alterar TutorPromptEnvelope;
alterar os 6008 caracteres certificados;
remover qualquer dos 15 blocos;
alterar idioma pt-BR;
remover Evidence Grounding;
reduzir segurança;
aumentar timeouts como solução;
introduzir respostas sintéticas.

==================================================
GATE 0 — TUTOR CONTRACT LOCK
==================================================

Antes de executar qualquer Wave:

calcular:

current_tutor_contract_hash

comparar com:

certified_tutor_contract_hash

Exigir:

current == certified

e:

system_prompt_chars == 6008

Se falhar:

STOP

retornar:

TUTOR_CONTRACT_REGRESSION_DETECTED

Nenhuma otimização pode prosseguir.

==================================================
REGRESSION GATE PERMANENTE
==================================================

Criar teste automatizado que valide:

contract_version
contract_hash
contract_chars
15 strategic blocks
language contract
provider adapter parity

Qualquer futura alteração deve falhar CI se:

prompt truncado
bloco removido
idioma removido
adapter modificar conteúdo

Mudança intencional do contrato exige:

nova versão
novo hash
nova certificação.

==================================================
REGRA DE ARQUITETURA
==================================================

O TutorPromptEnvelope é IMUTÁVEL.

Performance pode otimizar:

provider routing
health checks
timeouts
retrieval
cache
memória
histórico
persistência
telemetria
streaming
fallback
concorrência

Performance NÃO pode otimizar:

security contract
pedagogical contract
language contract
15 strategic blocks

==================================================
WAVE 1 — PERFORMANCE FORENSICS
==================================================

PRIMEIRO MEDIR.

Não alterar arquitetura ainda.

Instrumentar cada request com:

trace_id

Medir:

auth_ms
session_ms
conversation_ms
topic_detection_ms
memory_ms

evidence_cache_lookup_ms
internal_evidence_ms
pubmed_ms
pmc_ms
evidence_merge_ms
context_pack_ms

router_ms

provider_attempt_1_ms
provider_attempt_2_ms
provider_attempt_3_ms

provider_ttft_ms
provider_generation_ms

grounding_ms
validation_ms
persistence_ms
telemetry_ms

total_ms

Também registrar:

provider_attempt_count
fallback_count
evidence_cache_hit
safe_mode
content_present

Não registrar:

JWT
API keys
senhas
conteúdo privado desnecessário.

==================================================
BASELINE REAL
==================================================

Executar no mínimo:

Tutor ................. 10 requests
Plantão ................ 5
Question Generator ..... 5
Flashcards ............. 5
Mnemônicos ............. 5
Planner ................ 5

TOTAL .................. 35 execuções reais

Tutor obrigatório:

IAM
Sepse
TEP
CAD
AVC
Bronquiolite
Pneumonia
IC
Pré-eclâmpsia
Apendicite

Registrar:

p50
p95
max
TTFT
success rate
fallback rate
provider attempts
5xx

Não usar números históricos como se fossem novos testes.

==================================================
WAVE 2 — PROVIDER HEALTH CLEANUP
==================================================

Auditar todos os providers/modelos usados em produção.

Classificar:

HEALTHY
DEGRADED
UNAVAILABLE
MISCONFIGURED
SHADOW

Modelos com:

400 MODEL_INVALID
401 AUTH
402 QUOTA
403 PERMISSION
404 MODEL_NOT_FOUND

devem ser removidos imediatamente da cadeia daquele request.

Não gastar timeout tentando modelo sabidamente inválido.

==================================================
LEGACY MODEL GUARD
==================================================

Bloquear modelos legados já identificados.

Especialmente:

google/gemini-2.0-flash

Não permitir que env antiga reintroduza modelo inválido.

Runtime model registry deve validar o modelo ANTES do fetch.

==================================================
WAVE 3 — REMOVE ROUTER NESTING
==================================================

Auditar:

ai-runtime-orchestrator
ai-fetch
eu-ai
Railway
Lovable Gateway
provider-specific clients

Encontrar:

router → router → router

Exemplo ruim:

Tutor
→ orchestrator
→ eu-ai
→ Railway
→ outro router
→ provider

Eliminar decisões duplicadas.

Deve existir UMA autoridade de fallback:

UnifiedAIRuntime.

Adapters de provider NÃO devem criar nova política global de roteamento.

==================================================
WAVE 4 — GLOBAL DEADLINE
==================================================

Implementar deadline GLOBAL.

Não somar timeouts.

Targets iniciais:

Tutor:
15s hard budget

Plantão:
15s

Question Generator:
20s

Flashcards:
10s

Mnemônicos:
8s

Planner:
8s

Cada provider recebe:

remaining_budget_ms

Nunca permitir:

20s provider A
+
25s provider B
+
20s provider C

==================================================
WAVE 5 — CIRCUIT BREAKER
==================================================

Circuit breaker centralizado.

Permanent-ish failures:

MODEL_INVALID
AUTH_FAILURE
QUOTA_BLOCKED
PERMISSION_DENIED
MODEL_NOT_FOUND

→ não repetir imediatamente.

Transient:

429
502
503
504
network timeout

→ contador.

Após threshold:

OPEN CIRCUIT

durante cooldown.

Durante circuit open:

0 requests para aquele provider/model.

==================================================
WAVE 6 — EVIDENCE CACHE
==================================================

Não remover EG-3.

Otimizar EG-3.

Cache key baseada em:

canonical_topic
specialty
evidence_version
task_profile

Se EvidenceContextPack válido existir:

CACHE HIT
→ reutilizar.

Não consultar PubMed novamente para cada mensagem da mesma sessão/tema.

==================================================
EVIDENCE TTL
==================================================

Definir TTL de acordo com natureza da evidência.

Não hardcodar um TTL universal sem justificativa.

Guideline estável pode ter cache maior.

Live retrieval pode ter cache menor.

Registrar:

evidence_generated_at
evidence_version
cache_age
cache_hit

==================================================
WAVE 7 — INTENT-AWARE RETRIEVAL
==================================================

Classificar pergunta antes do retrieval:

NO_RETRIEVAL
LIGHT_RETRIEVAL
FULL_CLINICAL_RETRIEVAL

Exemplos:

"continue"
"sim"
"repita"
"não entendi"

→ NO_RETRIEVAL quando o contexto atual for suficiente.

Nova pergunta clínica:

→ FULL_CLINICAL_RETRIEVAL.

Não executar PubMed desnecessariamente.

==================================================
WAVE 8 — PARALLEL EVIDENCE
==================================================

Quando retrieval completo for necessário:

internal corpus
PubMed
PMC
GOLD
official exam corpus

executar em paralelo quando independentes.

Usar:

Promise.allSettled

com budgets individuais.

Não executar sequencialmente sem necessidade.

==================================================
WAVE 9 — CONTEXT BUDGET
==================================================

Se o prompt ficar grande:

NUNCA truncar Tutor contract.

Ordem para redução:

1. remover histórico redundante;
2. resumir mensagens antigas;
3. comprimir memória longitudinal;
4. deduplicar evidências;
5. selecionar evidências por autoridade/relevância;
6. remover referências duplicadas.

Nunca reduzir:

Tutor contract
language contract
security contract
critical evidence instructions.

==================================================
WAVE 10 — ASYNC NON-CRITICAL I/O
==================================================

Auditar:

ai_runtime_logs
cost metrics
analytics
pedagogical events
non-critical memory updates
observability

Tudo que não for necessário para renderizar resposta deve ocorrer:

após resposta
via waitUntil()
ou mecanismo assíncrono seguro.

Não esperar telemetria para responder ao aluno.

==================================================
PERSISTÊNCIA
==================================================

Separar:

CRITICAL PERSISTENCE
de
NON-CRITICAL PERSISTENCE.

Não perder conversa para ganhar velocidade.

Mas não bloquear render esperando analytics.

==================================================
WAVE 11 — STREAMING
==================================================

Para providers com streaming confiável:

usar streaming real.

Meta:

TTFT < 3s

Fluxo:

provider
→ primeiros tokens
→ validação mínima segura
→ UI começa renderização
→ geração continua

Grounding final continua obrigatório.

Não mostrar reasoning privado.

==================================================
WAVE 12 — HEDGED FALLBACK
==================================================

Somente para módulos interativos e somente se custo justificar.

Tutor:

primary inicia.

Se após aproximadamente 2–3s não houver progresso/TTFT:

iniciar segundo provider HEALTHY.

Primeira resposta válida que passar:

contract
topic
grounding
language

vence.

Abortar chamada perdedora.

Não usar hedging indiscriminadamente.

==================================================
WAVE 13 — LANGUAGE GATE
==================================================

Preservar:

response_language = pt-BR

Se output predominantemente inglês:

ENGLISH_LANGUAGE_LEAK

Não entregar como sucesso.

Não repetir retrieval.

Somente correção curta de linguagem quando seguro.

==================================================
WAVE 14 — FALLBACK CONTRACT PARITY
==================================================

Todos os providers devem receber semanticamente:

MESMO TutorPromptEnvelope
MESMO language contract
MESMO EvidenceContextPack
MESMO user message
MESMO context_hash

Fallback não pode transformar:

Tutor V3
→ chatbot genérico.

==================================================
WAVE 15 — PROVIDER ROUTING
==================================================

Não escolher provider apenas por ordem hardcoded.

Considerar:

health
task
p50
p95
success_rate
grounding_quality
cost
capability

Mas NÃO promover NVIDIA/Cerebras automaticamente.

Eles permanecem conforme status de produção atual até decisão formal.

==================================================
PERFORMANCE TARGETS
==================================================

TUTOR

p50 total ............. < 5s
p95 total ............. < 12s
TTFT p50 .............. < 3s
success ............... > 99%
5xx ................... 0
infinite thinking ..... 0

PLANTÃO

p50 ................... < 6s
p95 ................... < 12s

QUESTION GENERATOR

p50 ................... < 8s
p95 ................... < 15s

FLASHCARDS

p50 ................... < 4s
p95 ................... < 8s

MNEMÔNICOS

p50 ................... < 4s
p95 ................... < 8s

PLANNER

p50 ................... < 4s
p95 ................... < 8s

==================================================
QUALITY HARD GATES
==================================================

Nenhum ganho de performance será aceito se houver regressão pedagógica.

Tutor:

contract hash parity ........ PASS
system chars ................ 6008
blocks ...................... 15/15
pt-BR ....................... PASS

Tarefas clínicas:

grounding >= 0.90
unsupported_claim_rate <= 0.05
critical_hallucination = 0
exact topic = PASS

==================================================
TESTE PÓS-WAVE
==================================================

Após CADA wave:

1. executar smoke tests;
2. verificar contract hash;
3. verificar 6008 chars;
4. verificar 15/15;
5. verificar pt-BR;
6. verificar grounding;
7. comparar latência;
8. comparar error rate.

Se qualquer gate pedagógico piorar:

ROLLBACK DA WAVE.

==================================================
NÃO FAZER
==================================================

NÃO usar:

systemPrompt.slice(...)
TutorPromptEnvelope.slice(...)
prompt.substring(...)

NÃO aumentar timeout como solução.

NÃO remover PubMed.

NÃO remover Evidence Grounding.

NÃO remover memória necessária.

NÃO alterar os 15 blocos.

NÃO simplificar Tutor V3.

NÃO alterar UI.

NÃO atualizar War Room para substituir execução real.

NÃO usar Math.random.

NÃO inventar benchmark.

==================================================
CRITÉRIOS DE ACEITE FINAL
==================================================

Tutor contract hash ............ PASS
Tutor chars .................... 6008
Blocks ......................... 15/15
pt-BR .......................... 100%
English leakage ................ 0

Nested routers ................. 0
Legacy models .................. 0
Invalid provider attempts ...... 0
Global deadlines ............... PASS
Circuit breaker ................ PASS
Evidence cache ................. PASS
Intent-aware retrieval ......... PASS
Parallel retrieval ............. PASS
Async non-critical I/O ......... PASS

Tutor p50 ...................... <5s
Tutor p95 ...................... <12s
Tutor 5xx ...................... 0
Infinite thinking .............. 0

Grounding regression ........... NO
Pedagogical regression ......... NO
Security regression ............ NO

==================================================
RELATÓRIO OBRIGATÓRIO
==================================================

AI PERFORMANCE RECOVERY V2 — FINAL REPORT

CONTRACT LOCK
--------------------------------
Version ....................... ?
Certified SHA-256 ............. <FULL HASH>
Current SHA-256 ............... <FULL HASH>
Hash parity ................... PASS/FAIL
Chars ......................... ?/6008
Blocks ........................ ?/15
pt-BR ......................... PASS/FAIL

BASELINE
--------------------------------
Tutor p50 ..................... ?
Tutor p95 ..................... ?
Tutor TTFT .................... ?
Provider attempts avg ......... ?
Fallback rate ................. ?
Evidence cache hit ............ ?

BOTTLENECKS FOUND
--------------------------------
1. ?
2. ?
3. ?
4. ?
5. ?

ARCHITECTURE AFTER
--------------------------------
Nested routers ................ ?
Global deadline ............... PASS/FAIL
Circuit breaker ............... PASS/FAIL
Health routing ................ PASS/FAIL
Evidence cache ................ PASS/FAIL
Parallel retrieval ............ PASS/FAIL
Async I/O ..................... PASS/FAIL
Streaming ..................... PASS/FAIL

TUTOR AFTER
--------------------------------
N ............................. ?
Success ....................... ?
p50 ........................... ?
p95 ........................... ?
TTFT p50 ...................... ?
Fallback rate ................. ?
Provider attempts avg ......... ?
Evidence cache hit ............ ?
Grounding ..................... ?
5xx ........................... ?
Infinite thinking ............. ?

OTHER MODULES
--------------------------------
Plantão p50/p95 ............... ?
Question Generator p50/p95 .... ?
Flashcards p50/p95 ............ ?
Mnemônicos p50/p95 ............ ?
Planner p50/p95 ............... ?

REGRESSION
--------------------------------
Tutor contract changed ........ NO
Pedagogical regression ........ NO
Language regression ........... NO
Grounding regression .......... NO
RLS changed ................... NO
Security bypass ............... NO
FINAL_ROUTING_V1 changed ...... NO

==================================================
EXECUTION ORDER
==================================================

Execute:

WAVE 1
→ medir baseline real

depois:

WAVE 2
→ eliminar providers/modelos inválidos

depois:

WAVE 3
→ eliminar nested routers

depois:

WAVE 4–10
→ otimizações de caminho crítico

Somente então considerar:

WAVE 11–12
streaming/hedging.

Após cada Wave:

CONTRACT GATE obrigatório.

==================================================
FINAL STATUS
==================================================

Somente declarar:

AI PERFORMANCE V2 CERTIFIED
TUTOR CONTRACT PRESERVED

se:

performance targets PASS
+
clinical quality PASS
+
Tutor contract PASS.

Caso contrário:

AI PERFORMANCE V2 PARTIAL

informando exatamente:

remaining_bottleneck
module
measured_p50
measured_p95
root_cause
next_action

REGRA FINAL:

O Tutor V3 certificado é agora uma INVARIANTE DO SISTEMA.

OTIMIZE AO REDOR DELE.

NÃO OTIMIZE DENTRO DELE.

EXECUTE.`;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 overflow-auto selection:bg-green-500 selection:text-black">
      <div className="max-w-4xl mx-auto border border-green-900/30 p-8 bg-green-950/5 shadow-[0_0_50px_rgba(0,255,0,0.05)]">
        <div className="flex justify-between items-center mb-12 border-b border-green-900/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            <h1 className="text-2xl font-bold tracking-tighter">WAR ROOM — PERFORMANCE RECOVERY</h1>
          </div>
          <div className="text-xs opacity-50 space-x-4">
            <span>AI PERFORMANCE RECOVERY V1</span>
            <span>2026-08-11</span>
            <span>WAVE 1 ACTIVE</span>
          </div>
        </div>
        
        <pre className="whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
          {content}
        </pre>
        
        <div className="mt-12 pt-6 border-t border-green-900/30 text-[10px] opacity-30 flex justify-between">
          <span>SECURE PROTOCOL V4.2.0</span>
          <span>AUDIT_LOG_COMMITTED</span>
        </div>
      </div>
    </div>
  );
}


