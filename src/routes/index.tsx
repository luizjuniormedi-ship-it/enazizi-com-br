import React from 'react';

export default function EG3Foundation() {
  const content = `WAR ROOM — FINAL REAL AI ROUTING BENCHMARK
EG-3 EVIDENCE-GROUNDED PROVIDER ARENA
MODE: EXECUTION / NO MOCKS / NO SYNTHETIC RESULTS

OBJETIVO

Executar DE VERDADE o benchmark final dos providers de IA do ENAZIZI usando a infraestrutura EG-3.

Este não é um pedido para:
- escrever o protocolo em uma página;
- alterar src/routes/index.tsx;
- criar dashboard;
- criar relatório fictício;
- criar código que simula resultados;
- estimar resultados.

A tarefa é:

EXECUTAR CHAMADAS REAIS AOS PROVIDERS
+
MEDIR RESULTADOS REAIS
+
VALIDAR CONTRA EVIDÊNCIAS REAIS
+
PRODUZIR O RELATÓRIO A PARTIR DOS DADOS OBSERVADOS.

==================================================
P0 — INVALIDAR BENCHMARKS SINTÉTICOS
==================================================

Antes de executar:

Auditar scripts e resultados anteriores relacionados a:

EG-2
EG-3
provider benchmark
AI arena
routing benchmark

Procurar especificamente:

Math.random()
Math.floor()
random score
mock
fixture
fake
synthetic
simulate
simulated
hardcoded score
hardcoded latency
hardcoded grounding
hardcoded hallucination
placeholder metrics

O benchmark anterior que utilizou algo equivalente a:

0.94 + Math.random() * 0.05

NÃO É evidência válida.

Marcar formalmente:

EG2_SYNTHETIC_BENCHMARK = INVALIDATED

Não utilizar seus scores para decisão de roteamento.

Telemetria histórica real pode ser usada apenas como contexto secundário e deve ser identificada como HISTORICAL.

==================================================
REGRA ABSOLUTA
==================================================

PROIBIDO:

Math.random()
scores inventados
latências inventadas
tokens inventadas
grounding inventado
resultados hardcoded
simulação de chamadas
mock de provider
mock de PubMed
mock de Evidence Pack
mock de context_hash
reutilizar tabela antiga como execução nova
declarar PASS sem evidência observável
declarar CERTIFIED sem completar o benchmark

Se um provider não puder ser chamado:

marcar:

NOT EXECUTED

e informar a causa real.

NUNCA substituir ausência de execução por valores simulados.

==================================================
P1 — AUDITAR O ROUTER ANTES DO TESTE
==================================================

Auditar:

supabase/functions/_shared/evidence-grounding/router.ts

Foi detectado anteriormente um possível stub contendo lógica semelhante a:

let provider = 'google/gemini-2.0-flash';

e comentários indicando que a implementação real ainda seria adicionada.

Verificar o estado ATUAL.

O benchmark NÃO pode depender de um router stub.

Não alterar roteamento produtivo.

Para o benchmark, criar um runner isolado capaz de chamar explicitamente cada provider.

Também verificar inconsistência:

gemini-2.0-flash
vs
gemini-2.5-flash

O candidato deste benchmark é:

google/gemini-2.5-flash

Não trocar silenciosamente o modelo.

==================================================
PROVIDERS DO BENCHMARK
==================================================

Executar exatamente:

1.
Google
gemini-2.5-flash

2.
OpenAI
gpt-5-mini

3.
Google
gemini-2.5-pro

4.
NVIDIA
meta/llama-3.1-8b-instruct

5.
Cerebras
gpt-oss-120b

NVIDIA llama-3.3-70b:

SHADOW_ONLY
não participa do ranking principal.

Claude Gateway:

DEGRADED
não participa enquanto o problema atual não estiver resolvido.

==================================================
GATE 0 — PROVIDER PREFLIGHT
==================================================

Antes das 450 execuções, realizar UMA chamada real mínima por provider.

Registrar:

provider
model solicitado
model efetivamente usado
HTTP status
latency_ms
content_present
output_chars
input_tokens se disponível
output_tokens se disponível
error real
timestamp

Critério:

REAL_PROVIDER_PREFLIGHT

Gemini Flash ........ PASS/FAIL
GPT-5 Mini .......... PASS/FAIL
Gemini Pro .......... PASS/FAIL
NVIDIA 8B ........... PASS/FAIL
Cerebras 120B ....... PASS/FAIL

Se o modelo solicitado não for o efetivamente executado:

FAIL.

Não fazer alias silencioso.

==================================================
GATE 1 — EVIDENCE ENGINE REAL
==================================================

Utilizar a infraestrutura EG-3 existente.

Para cada caso executar retrieval UMA VEZ.

Fluxo:

Clinical Case
↓
Canonical Topic Engine
↓
Unified Medical Evidence Service
↓
Internal ENAZIZI Corpus
+
GOLD
+
Official Exams
+
Guidelines disponíveis
+
PubMed
+
PMC quando disponível
↓
EvidenceContextPack
↓
FREEZE
↓
context_hash
↓
mesmo pack para todos os providers

IMPORTANTE:

A memória paramétrica do LLM NÃO conta como evidência.

==================================================
PROVA DE RETRIEVAL
==================================================

Para cada caso registrar dados reais:

canonical_topic
context_pack_id
context_hash
evidence_count
internal_evidence_count
gold_count
official_exam_count
pubmed_count
pmc_count
PMIDs recuperados
PMCIDs quando existentes
retrieval_latency_ms
retrieval_confidence
retrieved_at

Não é suficiente retornar:

PubMed = PASS

É necessário demonstrar que houve retrieval.

==================================================
CONTEXT HASH PARITY
==================================================

Todos os providers do mesmo caso devem receber o MESMO:

context_pack_id
context_hash

Antes da geração verificar:

Gemini Flash hash
GPT-5 Mini hash
Gemini Pro hash
NVIDIA hash
Cerebras hash

Todos precisam ser idênticos.

Se não forem:

CASE_STATUS = BENCHMARK_INVALID

Não gerar ranking para esse caso.

==================================================
DATASET
==================================================

Executar 30 casos clínicos.

Cobrir:

Cardiologia
Infectologia
Pediatria
Cirurgia
Ginecologia/Obstetrícia
Pneumologia
Endocrinologia
Neurologia
Clínica Médica

Obrigatórios:

IAM/STEMI
NSTEMI
Sepse
Choque Séptico
TEP
Cetoacidose Diabética
CAD Pediátrica
Bronquiolite
AVC Isquêmico
Pré-eclâmpsia
Eclâmpsia
Abdome Agudo
Apendicite
Pneumonia
Insuficiência Cardíaca

Completar 30 com temas representativos do ENAMED/ENARE.

==================================================
TAREFAS
==================================================

Cada caso:

TASK A
QUESTION_GENERATION

Gerar questão estilo ENARE com resposta e explicação.

TASK B
TUTOR

Produzir explicação pedagógica do caso.

TASK C
CLINICAL_SIMULATION

Produzir raciocínio/conduta equivalente ao modo Plantão.

Total esperado:

30 casos
×
3 tarefas
×
5 modelos

= 450 EXECUÇÕES REAIS

Retries devem ser contabilizados separadamente.

==================================================
PROMPT PARITY
==================================================

Dentro de cada task:

mesma instrução
mesmo EvidenceContextPack
mesmo output contract
mesmo idioma
mesmo limite lógico de resposta

Não favorecer nenhum provider através de prompts diferentes.

Somente adaptar parâmetros técnicos obrigatórios da API quando necessário.

Exemplo:

GPT-5 Mini:
não enviar temperature se não suportada.

Isso é adaptação de transporte, não alteração semântica do prompt.

==================================================
CEREBRAS CONTRACT
==================================================

Regra obrigatória:

content presente
→ COMPLETE

content vazio + reasoning presente
→ INCOMPLETE_GENERATION

content vazio + reasoning vazio
→ EMPTY_GENERATION

É PROIBIDO:

reasoning → resposta final

Nunca expor reasoning interno.

Para INCOMPLETE_GENERATION:

retry com token budget adequado.

Se continuar incompleto:

FAIL.

Fallback não pode transformar a execução em sucesso do Cerebras.

==================================================
RATE LIMIT
==================================================

Executar em batches controlados.

Não disparar 450 chamadas simultaneamente.

Implementar concorrência independente por provider.

Registrar:

429
503
504
timeout
retry
Retry-After quando fornecido
circuit breaker

Aplicar exponential backoff + jitter operacional.

O jitter pode controlar intervalo de retry.

JAMAIS utilizar aleatoriedade para gerar métricas ou scores.

==================================================
RAW EXECUTION RECORD
==================================================

Cada chamada deve gerar um registro técnico com:

run_id
case_id
task
provider
requested_model
effective_model
context_pack_id
context_hash
started_at
finished_at
latency_ms
http_status
success
content_present
output_chars
input_tokens
output_tokens
retry_count
error_code
error_message

E também avaliação:

grounding_score
supported_claim_rate
unsupported_claim_rate
critical_hallucination
answer_key_supported
evidence_coverage
evidence_conflict_handling
exact_topic_fidelity
sibling_contamination
json_valid
pt_br_compliance

Não registrar:

API KEY
JWT
password
reasoning privado
secret

==================================================
GROUNDING
==================================================

Avaliar cada output CONTRA O EvidenceContextPack real.

Não perguntar ao próprio modelo:

"você está correto?"

como mecanismo único de avaliação.

Claims clínicos relevantes precisam ser vinculáveis a:

source_ids[]
PMID
PMCID
guideline/internal source

quando aplicável.

Calcular:

SUPPORTED_CLAIM_RATE

UNSUPPORTED_CLAIM_RATE

GROUNDING_SCORE

==================================================
CRITICAL HALLUCINATION
==================================================

Considerar crítica qualquer afirmação sem suporte relevante envolvendo:

diagnóstico
tratamento
dose
contraindicação
indicação
urgência
prognóstico
gabarito
conduta clínica

CRITICAL_HALLUCINATION > 0

→ HARD FAIL daquela execução.

==================================================
HARD GATES
==================================================

Grounding < 0.90
→ FAIL

Unsupported Claim Rate > 5%
→ FAIL

Critical Hallucination > 0
→ FAIL

Answer Key unsupported
→ FAIL

Exact Topic failure
→ FAIL

Sibling contamination relevante
→ FAIL

Evidence conflict crítico ignorado
→ FAIL

Different context_hash
→ BENCHMARK INVALID

Empty generation
→ FAIL

Fake/synthetic metric detected
→ ENTIRE BENCHMARK INVALID

==================================================
IAM STRESS TEST
==================================================

Canonical topic:

INFARTO AGUDO DO MIOCÁRDIO

Aliases válidos:

IAM
STEMI
NSTEMI
SCA
Acute Myocardial Infarction
Acute Coronary Syndrome

Monitorar:

Pericardite
Miocardite
Insuficiência Cardíaca
Endocardite

Esses termos podem aparecer legitimamente em diagnóstico diferencial.

Mas não podem substituir o tema principal.

==================================================
SCORING
==================================================

Somente execuções que passaram pelos HARD GATES entram no score.

Pesos:

Grounding / Evidence Fidelity ..... 25%
Clinical / Answer-Key Support ..... 20%
Exact Topic Fidelity .............. 15%
Evidence Coverage ................. 10%
Pedagogical Quality ............... 10%
Reliability ....................... 10%
Latency ........................... 5%
Contract / JSON ................... 5%

Não usar comprimento da resposta como qualidade.

==================================================
ESTATÍSTICA
==================================================

Por provider e task calcular a partir dos registros REAIS:

N
success rate
hard-gate pass rate
mean
median
standard deviation
p50
p95
p99 quando N permitir
429 rate
5xx rate
timeout rate
retry rate
empty generation rate
incomplete generation rate

==================================================
REPRODUCIBILIDADE
==================================================

Depois das 450 execuções:

selecionar amostra estratificada de pelo menos 10% das execuções.

Reexecutar.

Comparar:

hard-gate result
topic fidelity
answer-key support
grounding
operational success

Não exigir texto idêntico.

Exigir estabilidade suficiente da decisão.

Registrar:

REPRODUCIBILITY_PASS_RATE

==================================================
RESILIÊNCIA
==================================================

Depois do benchmark principal:

simular indisponibilidade do vencedor SEM alterar produção.

Testar:

PRIMARY unavailable
↓
FALLBACK_1
↓
FALLBACK_2

Todos devem continuar utilizando:

SAME EvidenceContextPack
+
Grounding Guard

Fallback jamais pode ignorar a Evidence Layer.

==================================================
NÃO ALTERAR PRODUTO
==================================================

DO NOT:

alterar Landing
alterar Index
alterar Dashboard
substituir src/routes/index.tsx por relatório
alterar UX
alterar RLS
alterar GOLD
alterar banco produtivo de questões
ativar NVIDIA em produção
ativar Cerebras em produção
mudar Gemini em produção
mudar OpenAI em produção
mudar Claude
migrar módulos
promover canary

ESTA FASE É SOMENTE BENCHMARK.

==================================================
ARTEFATOS
==================================================

Salvar resultados técnicos fora da UI produtiva.

Criar preferencialmente:

docs/ai-benchmark/FINAL_REAL_AI_ROUTING_BENCHMARK.md

e dados estruturados:

docs/ai-benchmark/final-real-ai-routing-results.json

Se necessário, criar runner:

scripts/ai-benchmark/final-real-routing-benchmark.ts

ou localização equivalente apropriada ao projeto.

Não criar uma página pública apenas para mostrar o relatório.

==================================================
AUDITABILIDADE
==================================================

O JSON precisa permitir conferir:

quantas chamadas realmente aconteceram.

Exigir:

planned_primary_executions = 450

actual_primary_executions = número real

actual_provider_requests = incluindo retries

Não declarar benchmark completo se:

actual_primary_executions < 450

==================================================
RESULTADO FINAL
==================================================

Produzir:

WAR ROOM — FINAL REAL AI ROUTING DECISION

Preflight
--------------------------------
Gemini Flash ................. PASS/FAIL
GPT-5 Mini ................... PASS/FAIL
Gemini Pro ................... PASS/FAIL
NVIDIA 8B .................... PASS/FAIL
Cerebras 120B ................ PASS/FAIL

Execution
--------------------------------
Cases planned ................ 30
Cases completed .............. ?
Tasks/case ................... 3
Providers .................... 5
Primary executions planned ... 450
Primary executions actual .... ?
Total API requests ........... ?
Retries ...................... ?

Evidence
--------------------------------
Evidence retrieval ........... PASS/FAIL
PubMed retrieval ............. PASS/FAIL
PMC retrieval ................ PASS/FAIL/NOT_AVAILABLE
Context Hash Parity .......... PASS/FAIL
Grounding validation ......... PASS/FAIL

Integrity
--------------------------------
Mocks used ................... NO
Synthetic scores ............. NO
Math.random metrics .......... NO
Hardcoded results ............ NO
Historical data presented
as current execution ......... NO

==================================================
TABELA FINAL
==================================================

Para cada modelo:

MODEL
N
SUCCESS RATE
HARD-GATE PASS RATE
GROUNDING
SUPPORTED CLAIM RATE
UNSUPPORTED CLAIM RATE
CRITICAL HALLUCINATIONS
ANSWER KEY SUPPORT
TOPIC FIDELITY
SIBLING CONTAMINATION
EVIDENCE COVERAGE
JSON VALIDITY
P50
P95
429
5XX
TIMEOUT
RETRY RATE

==================================================
RANKINGS
==================================================

Gerar ranking independente:

QUESTION_GENERATION

TUTOR

CLINICAL_SIMULATION

FAST

DEEP_REASONING

Não criar vencedor global artificial se os dados demonstrarem especialização por tarefa.

==================================================
ROUTING RECOMMENDATION
==================================================

Somente depois dos dados reais:

DEFAULT_CLINICAL = ?

QUESTION_GENERATOR = ?

TUTOR = ?

CLINICAL_SIMULATION = ?

FAST = ?

DEEP_REASONING = ?

FALLBACK_1 = ?

FALLBACK_2 = ?

SHADOW_ONLY = ?

REJECTED = ?

Cada recomendação deve apontar para as métricas que justificam a escolha.

==================================================
CERTIFICATION GATE
==================================================

Somente retornar:

FINAL REAL AI ROUTING BENCHMARK CERTIFIED
READY FOR ROUTING IMPLEMENTATION

SE:

450/450 execuções primárias reais concluídas
+
providers realmente chamados
+
EvidenceContextPack real
+
PubMed/PMC realmente testados
+
context hash parity confirmada
+
hard gates realmente calculados
+
nenhuma métrica sintética
+
resultados auditáveis
+
reproducibilidade executada

Caso qualquer condição falhe:

FINAL REAL AI ROUTING BENCHMARK NOT CERTIFIED

Informar:

failed_gate
provider
case
task
expected
observed
root_cause
recommended_fix

==================================================
REGRA FINAL
==================================================

NÃO ESCREVA O PROTOCOLO NA INTERFACE.

NÃO RESPONDA APENAS QUE "FOI IMPLEMENTADO".

EXECUTE O BENCHMARK.

Se houver impedimento técnico, PARE e reporte o impedimento real.

Não invente o resultado para completar a tarefa.

O objetivo é descobrir qual modelo utiliza melhor:

LITERATURA
+
DIRETRIZES
+
PUBMED/PMC
+
PROVAS OFICIAIS
+
GOLD
+
BANCO ENAZIZI

sob exatamente o mesmo EvidenceContextPack.

A Evidence Layer é a fonte da verdade.

Os LLMs são motores substituíveis.`;

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 whitespace-pre-wrap">
      {content}
    </div>
  );
}
