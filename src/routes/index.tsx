import React from 'react';

export default function EG3Foundation() {
  const content = `WAR ROOM — FINAL AI ROUTING DECISION TEST
EVIDENCE-GROUNDED PROVIDER ARENA

OBJETIVO

Executar UM ÚNICO benchmark final e controlado para definir o roteamento de IA do ENAZIZI.

Este teste deve utilizar obrigatoriamente a infraestrutura EG-3 já certificada.

NÃO implementar nova arquitetura.
NÃO alterar módulos.
NÃO alterar produção.
NÃO promover providers.
NÃO modificar prompts produtivos.
NÃO modificar RLS.
NÃO alterar banco GOLD.
NÃO substituir a Landing Page.

A missão é somente TESTAR, MEDIR e RECOMENDAR.

==================================================
PERGUNTA QUE O TESTE DEVE RESPONDER
==================================================

Considerando que todos os modelos recebem exatamente:

- mesmo banco ENAZIZI
- mesmas questões GOLD
- mesma literatura
- mesmos resultados PubMed
- mesmos documentos PMC disponíveis
- mesmas diretrizes
- mesmas provas oficiais
- mesmo Evidence Context Pack
- mesmo context_hash

qual provider/modelo apresenta a melhor combinação de:

1. fidelidade científica
2. utilização correta das fontes
3. precisão da resposta suportada
4. fidelidade ao tema
5. qualidade pedagógica
6. estabilidade
7. velocidade

para cada função do ENAZIZI?

==================================================
PROVIDERS
==================================================

Testar:

A.
google/gemini-2.5-flash

B.
openai/gpt-5-mini

C.
google/gemini-2.5-pro

D.
NVIDIA
meta/llama-3.1-8b-instruct

E.
Cerebras
gpt-oss-120b

Não incluir NVIDIA Llama 70B na competição principal.

Status:

NVIDIA 70B = SHADOW ONLY

Claude Gateway também não participa enquanto permanecer DEGRADED.

==================================================
REGRA MAIS IMPORTANTE
==================================================

RETRIEVAL DEVE ACONTECER UMA ÚNICA VEZ POR CASO.

Fluxo obrigatório:

CASE
↓
Canonical Topic Engine
↓
Unified Medical Evidence Service
↓
Internal Corpus
+
GOLD
+
Official Exams
+
Guidelines
+
PubMed
+
PMC quando disponível
↓
FREEZE EvidenceContextPack
↓
GENERATE context_hash
↓
ENVIAR O MESMO PACK PARA TODOS OS MODELOS

É PROIBIDO executar retrieval diferente para cada provider.

==================================================
CONTEXT HASH PARITY
==================================================

Para cada caso:

Gemini Flash context_hash
GPT context_hash
Gemini Pro context_hash
NVIDIA context_hash
Cerebras context_hash

devem ser:

IDENTICAL.

Se houver qualquer diferença:

BENCHMARK INVALID

Não continuar produzindo ranking daquele caso.

==================================================
CONJUNTO DE TESTE
==================================================

Executar 30 casos clínicos.

Distribuir entre:

Cardiologia
Infectologia
Pediatria
Cirurgia
Ginecologia/Obstetrícia
Pneumologia
Endocrinologia
Neurologia
Clínica Médica

Casos obrigatórios:

IAM / STEMI
NSTEMI
Sepse
Choque Séptico
TEP
Cetoacidose Diabética
CAD pediátrica
Bronquiolite
AVC Isquêmico
Pré-eclâmpsia
Eclâmpsia
Abdome Agudo
Apendicite
Pneumonia
Insuficiência Cardíaca

==================================================
BANCO + LITERATURA
==================================================

Cada caso deve utilizar prioritariamente:

1. diretrizes oficiais disponíveis
2. literatura médica validada
3. PubMed
4. PMC quando disponível
5. corpus ENAZIZI
6. provas oficiais
7. questões GOLD
8. banco validado

A memória paramétrica do LLM NÃO é evidence source.

==================================================
TRÊS TAREFAS POR CASO
==================================================

Cada modelo deve executar:

A — QUESTION GENERATION

Gerar questão estilo ENARE.

B — TUTOR

Explicar o caso de maneira pedagógica e tecnicamente correta.

C — CLINICAL DECISION

Executar raciocínio/conduta equivalente ao Modo Plantão.

Portanto:

30 casos
×
3 tarefas
×
5 modelos

= 450 execuções principais.

Executar em batches controlados para não provocar rate limit.

==================================================
RATE LIMIT CONTROL
==================================================

Não disparar chamadas massivamente em paralelo.

Aplicar concorrência controlada por provider.

Registrar:

429
503
504
timeout
retry
circuit breaker

Não prejudicar o resultado de um provider artificialmente por excesso de concorrência gerado pelo próprio benchmark.

==================================================
CEREBRAS
==================================================

Contrato obrigatório:

content presente
→ COMPLETE

content vazio + reasoning presente
→ INCOMPLETE_GENERATION

content vazio + reasoning vazio
→ EMPTY_GENERATION

NUNCA:

reasoning → final answer

Se INCOMPLETE_GENERATION:

retry com token budget adequado.

Se continuar incompleto:

FAIL
ou fallback apenas para análise operacional.

Não utilizar fallback para atribuir score ao modelo original.

==================================================
AVALIAÇÃO CIENTÍFICA
==================================================

Avaliar cada resposta contra o EvidenceContextPack congelado.

Medir:

GROUNDING_SCORE

SUPPORTED_CLAIM_RATE

UNSUPPORTED_CLAIM_RATE

CRITICAL_HALLUCINATION

ANSWER_KEY_SUPPORTED

EVIDENCE_COVERAGE

EVIDENCE_CONFLICT_HANDLING

EXACT_TOPIC_FIDELITY

SIBLING_CONTAMINATION

==================================================
HARD GATES
==================================================

Estes critérios têm precedência sobre qualquer score.

Grounding Score < 0.90
→ FAIL

Critical Hallucination > 0
→ FAIL

Unsupported Claim Rate > 5%
→ FAIL

Question Answer Key unsupported
→ FAIL

Exact Topic failure
→ FAIL

Sibling contamination relevante
→ FAIL

Evidence conflict crítico ignorado
→ FAIL

Context hash diferente
→ BENCHMARK INVALID

Nenhuma vantagem de velocidade pode compensar esses erros.

==================================================
IAM STRESS TEST
==================================================

Executar validação específica.

Canonical topic:

INFARTO AGUDO DO MIOCÁRDIO

Aliases permitidos:

IAM
STEMI
NSTEMI
SCA
Acute Myocardial Infarction
Acute Coronary Syndrome

Monitorar contaminação indevida por:

Pericardite
Miocardite
Insuficiência Cardíaca
Endocardite

Menção legítima em diagnóstico diferencial é permitida.

Substituição do tema principal:

FAIL.

==================================================
QUALIDADE PEDAGÓGICA
==================================================

Depois dos hard gates científicos, medir:

ENARE fidelity
clinical reasoning structure
distractor quality
explanation quality
instruction following
pt-BR compliance
JSON compliance

Não usar comprimento da resposta como proxy de qualidade.

==================================================
MÉTRICAS OPERACIONAIS
==================================================

Registrar:

HTTP success rate
p50
p95
p99 quando possível
input tokens
output tokens
total tokens
429 rate
5xx rate
timeout rate
retry rate
empty response rate
incomplete generation rate

Se custo estiver disponível de forma confiável:

cost/request
cost/1M tokens
estimated cost/1000 student interactions

Se custo não estiver disponível:

marcar NOT MEASURED.

Não inventar valores.

==================================================
PESOS
==================================================

Somente respostas que passaram pelos HARD GATES entram no score.

Score:

Grounding / Evidence Fidelity .... 25%

Clinical Support /
Answer-Key Support ............... 20%

Exact Topic Fidelity ............. 15%

Evidence Coverage ................ 10%

Pedagogical Quality .............. 10%

Reliability ...................... 10%

Latency .......................... 5%

Contract / JSON .................. 5%

==================================================
ESTABILIDADE
==================================================

Não utilizar somente média.

Calcular:

mean
median
standard deviation
p50
p95
failure rate

Modelo rápido mas instável não deve vencer automaticamente.

==================================================
RESULTADO POR TAREFA
==================================================

Gerar ranking separado para:

QUESTION GENERATION

TUTOR

CLINICAL SIMULATION

FAST TASKS

DEEP REASONING

Não gerar apenas um vencedor global.

==================================================
DECISÃO DE ROTEAMENTO
==================================================

Ao final recomendar exatamente:

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

==================================================
IMPORTANTE
==================================================

É permitido que o mesmo modelo vença várias categorias.

NÃO distribuir providers artificialmente apenas para usar todos.

Se Gemini Flash vencer:

Question Generator
Tutor
Plantão

ele pode ser recomendado para os três.

Se Cerebras ou NVIDIA realmente vencerem determinada categoria, recomendar com base nos dados.

==================================================
ANÁLISE DE RESILIÊNCIA
==================================================

Além de qualidade, simular indisponibilidade do provider vencedor.

Exemplo:

PRIMARY unavailable
↓
FALLBACK_1
↓
FALLBACK_2

Verificar se a cadeia continua:

Evidence Pack
↓
Provider
↓
Grounding Guard

O fallback nunca pode ignorar a Evidence Layer.

==================================================
NÃO ALTERAR PRODUÇÃO
==================================================

Mesmo após identificar vencedores:

DO NOT CHANGE ROUTING.

DO NOT ENABLE NVIDIA.

DO NOT ENABLE CEREBRAS.

DO NOT CHANGE GEMINI.

DO NOT CHANGE OPENAI.

DO NOT MODIFY CLAUDE.

Somente recomendar.

==================================================
NÃO ALTERAR A INTERFACE
==================================================

Não alterar:

/
Landing
Dashboard
Index
War Room público

O relatório pode ser gravado como artefato técnico ou exibido em rota administrativa existente.

==================================================
RELATÓRIO FINAL OBRIGATÓRIO
==================================================

WAR ROOM — FINAL AI ROUTING DECISION

Cases ........................ 30
Tasks per case ............... 3
Providers .................... 5
Executions planned ........... 450
Executions completed ......... ?

Context Hash Parity .......... PASS/FAIL
Evidence Retrieval ........... PASS/FAIL
PubMed/PMC ................... PASS/FAIL
Grounding Validation ......... PASS/FAIL

TABELA POR MODELO:

MODEL
SUCCESS RATE
HARD-GATE PASS RATE
GROUNDING
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
RANKING
==================================================

QUESTION GENERATION

1.
2.
3.
4.
5.

TUTOR

1.
2.
3.
4.
5.

CLINICAL SIMULATION

1.
2.
3.
4.
5.

FAST

1.
2.
3.
4.
5.

DEEP REASONING

1.
2.
3.
4.
5.

==================================================
ROUTING RECOMMENDATION
==================================================

DEFAULT_CLINICAL .............. ?

QUESTION_GENERATOR ............ ?

TUTOR ......................... ?

CLINICAL_SIMULATION ........... ?

FAST .......................... ?

DEEP_REASONING ................ ?

FALLBACK_1 .................... ?

FALLBACK_2 .................... ?

SHADOW_ONLY ................... ?

REJECTED ...................... ?

==================================================
DECISÃO
==================================================

Se o teste possuir:

same context
+
evidence retrieval validado
+
amostra completa
+
hard gates funcionando
+
resultados reproduzíveis

retornar:

FINAL AI ROUTING BENCHMARK CERTIFIED
READY FOR ROUTING IMPLEMENTATION

Caso contrário:

FINAL AI ROUTING BENCHMARK NOT CERTIFIED

e informar exatamente:

failed gate
provider
case
task
root cause

==================================================
REGRA FINAL

NÃO escolha a IA que demonstra possuir mais conhecimento médico de memória.

Escolha a IA que demonstra utilizar melhor:

LITERATURA
+
PUBMED/PMC
+
DIRETRIZES
+
PROVAS
+
BANCO ENAZIZI

fornecidos pelo Evidence Engine.

A Evidence Layer é a fonte da verdade.

Os modelos são motores substituíveis.`;

  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen whitespace-pre-wrap">
      {content}
    </div>
  );
}