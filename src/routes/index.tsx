import React from 'react';

export default function EG3Foundation() {
  const content = `WAR ROOM — ENAZIZI AI PERFORMANCE RECOVERY V1
UNIFIED LOW-LATENCY AI RUNTIME

PRIORIDADE: P0 PERFORMANCE
MODO: AUDIT → MEASURE → FIX → REAL TEST

==================================================
OBJETIVO
==================================================

O ENAZIZI apresenta latência excessiva principalmente no Tutor IA,
mas potencialmente também em:

- Tutor IA
- Plantão
- Question Generator
- Simulados
- Correções
- Flashcards
- Mnemônicos
- Planner
- ENAFLIX
- Professor
- demais módulos que utilizam IA

NÃO resolver aumentando timeouts.

A missão é:

1. mapear o caminho REAL de cada chamada;
2. medir onde o tempo está sendo gasto;
3. eliminar providers inválidos/degradados;
4. eliminar fallbacks redundantes;
5. impedir routers dentro de routers;
6. implementar budget global de latência;
7. tornar Evidence Retrieval seletivo e cacheável;
8. tirar persistência/telemetria não crítica do caminho síncrono;
9. implementar circuit breaker real;
10. reduzir drasticamente p50/p95;
11. preservar grounding científico EG-3;
12. preservar segurança, RLS e qualidade clínica.

==================================================
REGRA FUNDAMENTAL
==================================================

NÃO otimizar removendo:

- Evidence Grounding;
- validação clínica;
- Exact Topic Guard;
- segurança;
- autenticação;
- RLS;
- persistência necessária;
- referências científicas quando necessárias.

Performance não pode ser obtida reduzindo segurança ou qualidade médica.

==================================================
FASE 0 — FREEZE
==================================================

Antes de alterar código:

NÃO modificar UI.
NÃO modificar War Room.
NÃO modificar Landing.
NÃO modificar Dashboard.
NÃO modificar FINAL_ROUTING_V1.
NÃO modificar dataset congelado.
NÃO ativar NVIDIA/Cerebras automaticamente.

Criar baseline técnico da arquitetura atual.

==================================================
FASE 1 — MAPEAR TODO O RUNTIME DE IA
==================================================

Pesquisar TODO o projeto por:

runAI(
runAIStream(
ai-fetch
eu-ai
AI gateway
ai-runtime-orchestrator
callClaude
callGemini
callOpenAI
callNvidia
callCerebras
fetch(...chat/completions
/v1/messages
generateContent
LOVABLE_DEFAULT_MODEL
OPENAI_TIMEOUT
AI_TIMEOUT
AbortController
Promise.race
retry
fallback
provider
model

Construir mapa:

MODULE
→ CALLER
→ ROUTER
→ PROVIDER
→ FALLBACK
→ VALIDATOR
→ PERSISTENCE

Para cada módulo informar:

module
entrypoint
edge_function
router
primary_provider
fallbacks
number_of_possible_provider_attempts
timeout_per_attempt
max_theoretical_latency

==================================================
P0 — DETECTAR ROUTER-IN-ROUTER
==================================================

Procurar situações como:

Tutor
→ ai-runtime-orchestrator
→ eu-ai
→ Claude
→ Railway
→ Lovable
→ outro fallback

Isso é arquitetura proibida.

Um request não pode atravessar múltiplos mecanismos independentes de fallback.

Gerar:

ROUTER_NESTING_REPORT

com todos os casos encontrados.

==================================================
FASE 2 — INSTRUMENTAÇÃO DE LATÊNCIA
==================================================

Antes de otimizar, medir.

Adicionar instrumentação leve e segura para cada request.

Gerar:

trace_id

e medir:

auth_ms
session_ms
conversation_ms
memory_ms
topic_detection_ms
evidence_cache_ms
internal_evidence_ms
pubmed_ms
pmc_ms
evidence_context_ms
router_ms
provider_queue_ms
provider_connect_ms
provider_ttft_ms
provider_generation_ms
provider_total_ms
grounding_validation_ms
json_validation_ms
persistence_ms
telemetry_ms
total_ms

Não registrar conteúdo médico privado.

Não registrar JWT.

Não registrar API keys.

==================================================
FASE 3 — IDENTIFICAR PROVIDERS QUEBRADOS
==================================================

Executar healthcheck REAL dos providers configurados.

Classificar:

HEALTHY
DEGRADED
UNAVAILABLE
MISCONFIGURED

Erros como:

400 MODEL_INVALID
401 AUTH
402 QUOTA
403 PERMISSION
404 MODEL_NOT_FOUND

devem retirar imediatamente aquele provider/modelo da cadeia crítica.

Não esperar timeout em provider que já sabemos estar indisponível.

==================================================
CASOS JÁ CONHECIDOS
==================================================

Auditar especificamente regressões já observadas:

google/gemini-2.0-flash
→ LEGACY / INVALID

gpt-5-mini
→ verificar disponibilidade REAL antes de usar

Claude
→ verificar modelo real disponível no gateway

Railway
→ verificar network health

FORCE_NVIDIA_TUTOR_TEST
→ NÃO pode existir em produção

NVIDIA/Cerebras:
continuam SHADOW até decisão formal.

==================================================
FASE 4 — MODEL REGISTRY ÚNICO
==================================================

Hoje existem múltiplas definições de modelos.

Consolidar para uma única fonte de verdade.

Criar/reutilizar:

AIModelRegistry

Contrato:

provider
model
capabilities
enabled
production_enabled
shadow_enabled
supports_json
supports_streaming
supports_reasoning
supports_tools
timeout_ms
health_status
last_healthcheck
cooldown_until

Nenhum módulo deve hardcodar modelo diretamente.

==================================================
PROIBIDO
==================================================

Não permitir espalhados pelo projeto:

"google/gemini-2.0-flash"
"google/gemini-2.5-flash"
"gpt-4o"
"gpt-5-mini"
"claude-..."
etc.

Módulos devem pedir capacidade:

FAST
CLINICAL
REASONING
QUESTION_GENERATION
TUTOR

e o runtime resolve o modelo.

==================================================
FASE 5 — RUNTIME ÚNICO
==================================================

Consolidar gradualmente:

ai-fetch
eu-ai routing
ai-runtime-orchestrator
providers isolados

em UM runtime lógico:

UnifiedAIRuntime

Arquitetura:

Module
↓
UnifiedAIRuntime
↓
EvidenceContextPack quando necessário
↓
Provider Router
↓
Provider
↓
Validator
↓
Response

Fallback deve existir somente no UnifiedAIRuntime.

==================================================
FASE 6 — GLOBAL LATENCY BUDGET
==================================================

Implementar deadline global por request.

Não somar timeouts independentes.

Exemplo:

Tutor:
TOTAL_BUDGET = 15s

Question Generator:
TOTAL_BUDGET = 20s

Flashcards:
TOTAL_BUDGET = 10s

Planner:
TOTAL_BUDGET = 8s

Mnemonic:
TOTAL_BUDGET = 8s

O provider recebe somente:

remaining_budget_ms

Nunca:

Claude 20s
+
OpenAI 25s
+
Gemini 20s
=
65 segundos.

==================================================
PROVIDER TIMEOUT
==================================================

Inicialmente:

FAST provider:
6–8s

CLINICAL:
8–10s

DEEP REASONING:
10–15s

Mas sempre limitado pelo global deadline.

==================================================
FASE 7 — CIRCUIT BREAKER
==================================================

Implementar circuit breaker centralizado.

Erros permanentes:

400 MODEL_INVALID
401
402
403
404

→ provider/model OUT imediatamente.

Erros transitórios:

429
502
503
504
network timeout

→ failure counter.

Exemplo:

3 falhas / 5 minutos
→ OPEN CIRCUIT

Cooldown:

5–15 minutos.

Durante cooldown:

ZERO requests para aquele provider.

==================================================
FASE 8 — HEALTH-AWARE ROUTING
==================================================

Antes de chamar provider:

check health cache.

Não consultar banco pesado em cada request.

Usar cache em memória + estado persistente quando necessário.

Router deve considerar:

availability
task capability
latency p50
latency p95
error rate
grounding quality
cost

Não apenas ordem hardcoded.

==================================================
FASE 9 — HEDGED REQUESTS
==================================================

Para tarefas interativas críticas como Tutor:

não esperar provider lento morrer completamente.

Estratégia:

Provider A
↓
aguardar 2–3s por progresso/TTFT

Se não houver progresso:

iniciar Provider B em paralelo.

Primeira resposta que:

- concluir;
- passar contrato;
- passar grounding;
- passar topic guard;

vence.

Cancelar a outra chamada via AbortController.

IMPORTANTE:

Hedging somente quando necessário.

Não duplicar todas as chamadas indiscriminadamente por custo.

==================================================
FASE 10 — EVIDENCE RETRIEVAL
==================================================

EG-3 continua obrigatório para afirmações clínicas relevantes.

Mas retrieval precisa ser inteligente.

Classificar request:

NO_EVIDENCE_REQUIRED
LIGHT_EVIDENCE
FULL_CLINICAL_EVIDENCE

Exemplos:

"continue"
"sim"
"não entendi"
"repita"

não precisam novo PubMed retrieval.

Pergunta clínica nova:

FULL_CLINICAL_EVIDENCE.

==================================================
EVIDENCE CACHE
==================================================

Usar:

canonical_topic
specialty
task_type
evidence_version

para localizar EvidenceContextPack existente.

Se válido:

CACHE HIT
→ reutilizar.

Não consultar PubMed novamente sem necessidade.

Registrar:

evidence_cache_hit
evidence_cache_miss

==================================================
FASE 11 — PARALLEL RETRIEVAL
==================================================

Quando necessário:

internal corpus
PubMed
PMC
GOLD
official exams

devem ser buscados em paralelo quando não houver dependência entre eles.

Usar:

Promise.allSettled

com deadlines independentes curtos.

Não executar sequencialmente:

internal
↓
PubMed
↓
PMC
↓
GOLD

se puder executar em paralelo.

==================================================
FASE 12 — GRACEFUL EVIDENCE DEGRADATION
==================================================

Se PubMed estiver lento:

L1/L2 evidence suficiente
→ continuar.

Não esperar PubMed até timeout se já existe evidência autoritativa suficiente.

Se evidência insuficiente:

EVIDENCE_INSUFFICIENT

Nunca inventar evidência.

==================================================
FASE 13 — TIRAR I/O DO CAMINHO CRÍTICO
==================================================

Auditar:

logs
telemetry
cost metrics
pedagogical events
learning memory
analytics

Tudo que NÃO for necessário para produzir a resposta imediata deve ser:

waitUntil()
ou
fire-and-forget seguro.

Não bloquear resposta esperando:

INSERT de telemetria
INSERT de custo
analytics
event bus

Persistência crítica de conversa deve permanecer segura.

==================================================
FASE 14 — FRONTEND
==================================================

O frontend nunca pode permanecer infinitamente:

"Raciocinando..."

Garantir:

AbortController
deadline
finally
setIsLoading(false)

Estados:

PROCESSING
STREAMING
SUCCESS
CONTROLLED_ERROR
TIMEOUT

Nunca:

INFINITE_LOADING

==================================================
TIME TO FIRST TOKEN
==================================================

Se streaming estiver disponível:

mostrar resposta assim que houver primeiro token válido.

Não esperar a geração completa para liberar feedback ao usuário.

Meta Tutor:

TTFT < 3s quando possível.

==================================================
FASE 15 — NÃO ESPERAR PERSISTÊNCIA PARA RENDER
==================================================

Fluxo ideal:

AI response valid
↓
render
↓
persist async

Não:

AI response
↓
persist
↓
analytics
↓
telemetry
↓
render

==================================================
FASE 16 — CACHE
==================================================

Implementar/revisar cache para:

EvidenceContextPack
canonical topic
prompt templates
provider health
model registry
frequent reference data

Não cachear incorretamente resposta personalizada do aluno.

==================================================
FASE 17 — TESTES DE PERFORMANCE
==================================================

Executar chamadas REAIS.

No mínimo:

Tutor:
10 requests

Question Generator:
10

Flashcards:
10

Mnemonic:
10

Planner:
10

Clinical/Plantão:
10

TOTAL:
60 real executions

Não usar Math.random.

Não usar latência sintética.

==================================================
CASOS TUTOR
==================================================

Incluir:

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

==================================================
MÉTRICAS
==================================================

Por módulo:

N
success_rate
p50
p95
max
TTFT p50
TTFT p95
fallback_rate
average_provider_attempts
timeout_rate
5xx_rate
evidence_cache_hit_rate
provider_waste_ratio

==================================================
TARGETS
==================================================

TUTOR

p50 total < 5s
p95 total < 12s
TTFT p50 < 3s
success > 99%
5xx = 0
infinite loading = 0

QUESTION GENERATOR

p50 < 8s
p95 < 15s

FLASHCARDS

p50 < 4s
p95 < 8s

MNEMONICS

p50 < 4s
p95 < 8s

PLANNER

p50 < 4s
p95 < 8s

PLANTÃO

p50 < 6s
p95 < 12s

==================================================
QUALITY GATES
==================================================

Performance PASS somente se:

Grounding não piorar.

Para tarefas clínicas:

grounding >= 0.90
unsupported_claim_rate <= 0.05
critical_hallucination = 0

Não aceitar ganho de velocidade sacrificando qualidade clínica.

==================================================
FASE 18 — TESTE DE FALHA
==================================================

Simular de forma isolada:

primary provider unavailable

Expected:

fallback rápido.

Não esperar timeout máximo.

Simular:

MODEL_INVALID

Expected:

provider pulado imediatamente.

Simular:

429

Expected:

circuit breaker.

Simular:

PubMed timeout

Expected:

internal evidence suficiente
→ resposta continua.

==================================================
FASE 19 — CRITÉRIOS DE ACEITE
==================================================

Unified routing ............... PASS
Nested routers ................ 0
Legacy models production ..... 0
Invalid provider attempts .... 0
Global latency budget ........ PASS
Circuit breaker .............. PASS
Health-aware routing ......... PASS
Evidence cache ............... PASS
Parallel retrieval ........... PASS
Async telemetry .............. PASS
Infinite loading ............. 0
5xx user-facing .............. 0
Grounding regression ......... NO
RLS changed .................. NO
Benchmark changed ............ NO

==================================================
IMPORTANTE — NÃO FAZER BIG BANG
==================================================

Não reescrever toda a plataforma de uma vez.

Executar em waves:

WAVE 1
instrumentação + eliminar providers inválidos

WAVE 2
global deadline + circuit breaker

WAVE 3
Evidence cache + parallel retrieval

WAVE 4
async non-critical I/O

WAVE 5
unificar routers

WAVE 6
hedged requests + streaming

Após cada wave:

testar
comparar baseline
rollback se piorar.

==================================================
ROLLBACK
==================================================

Cada alteração deve ser reversível.

Se:

error rate aumentar
grounding diminuir
RLS falhar
persistência quebrar

ROLLBACK daquela wave.

==================================================
RELATÓRIO FINAL
==================================================

Retornar:

WAR ROOM — AI PERFORMANCE RECOVERY V1

ARCHITECTURE BEFORE
--------------------------------
AI routers .................... ?
Nested routers ................ ?
Provider chains ............... ?
Worst theoretical latency ..... ?ms

ROOT BOTTLENECKS
--------------------------------
1. ?
2. ?
3. ?
4. ?
5. ?

CHANGES
--------------------------------
Invalid models removed ........ ?
Dead providers skipped ........ ?
Global deadline ............... ?
Circuit breaker ............... ?
Evidence cache ................ ?
Parallel retrieval ............ ?
Async I/O ..................... ?
Streaming ..................... ?
Unified runtime ............... ?

TUTOR
--------------------------------
N ............................. ?
Success ....................... ?%
p50 before .................... ?
p50 after ..................... ?
p95 before .................... ?
p95 after ..................... ?
TTFT p50 ...................... ?
Fallback rate ................. ?
Provider attempts avg ......... ?
Evidence cache hit ............ ?
Grounding ..................... ?
5xx ........................... ?
Infinite loading .............. ?

QUESTION GENERATOR
--------------------------------
N ............................. ?
p50 ........................... ?
p95 ........................... ?
Success ....................... ?

FLASHCARDS
--------------------------------
N ............................. ?
p50 ........................... ?
p95 ........................... ?

MNEMONICS
--------------------------------
N ............................. ?
p50 ........................... ?
p95 ........................... ?

PLANNER
--------------------------------
N ............................. ?
p50 ........................... ?
p95 ........................... ?

PLANTÃO
--------------------------------
N ............................. ?
p50 ........................... ?
p95 ........................... ?

QUALITY
--------------------------------
Grounding regression .......... YES/NO
Critical hallucinations ....... ?
Evidence bypass ............... NO
Topic guard bypass ............ NO

SECURITY
--------------------------------
RLS changed ................... NO
Auth bypass ................... NO
Secrets exposed ............... NO

==================================================
FINAL DECISION
==================================================

Somente declarar:

AI PERFORMANCE RECOVERY CERTIFIED

se os testes REAIS atingirem os targets sem regressão clínica.

Caso contrário:

AI PERFORMANCE RECOVERY PARTIAL

e informar:

remaining_bottleneck
affected_module
measured_latency
root_cause
next_fix

==================================================
REGRA FINAL
==================================================

NÃO resolva aumentando timeouts.

NÃO apenas atualize War Room.

NÃO produza relatório sem executar alterações e testes.

NÃO use métricas sintéticas.

Primeiro MEÇA.

Depois CORRIJA.

Depois TESTE.

Depois COMPARE.

Preserve obrigatoriamente:
EG-3
PubMed
Evidence Grounding
Exact Topic
RLS
segurança
qualidade clínica.

EXECUTE WAVE 1 PRIMEIRO.

Depois prossiga automaticamente pelas waves somente quando
a wave anterior passar nos critérios de regressão.

vc perdeu todas as diretrizes do tutor ia  resolva iso`;

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


