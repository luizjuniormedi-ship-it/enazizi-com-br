import React from 'react';

export default function EG3Foundation() {
  const content = `WAR ROOM — EG-3 UNIFIED MEDICAL EVIDENCE SERVICE + PUBMED/PMC

MISSÃO

Criar uma camada científica única e obrigatória para todos os módulos clínicos e acadêmicos do ENAZIZI.

A partir desta fase, nenhum módulo médico deve chamar diretamente Gemini, OpenAI, NVIDIA, Cerebras ou Claude para produzir conteúdo clínico sem antes construir um Evidence Context Pack com base em fontes controladas.

PRINCÍPIO CENTRAL

LLM != FONTE DA VERDADE

FONTE DA VERDADE =
1. diretrizes oficiais
2. literatura médica validada
3. PubMed
4. PubMed Central quando full text estiver disponível
5. corpus ENAZIZI
6. banco GOLD
7. provas oficiais
8. banco validado

A memória paramétrica do modelo não conta como evidência.

ARQUITETURA OBRIGATÓRIA

MÓDULO
↓
Canonical Topic Engine
↓
Unified Medical Evidence Service
↓
Evidence Context Pack
↓
Unified AI Router
↓
Grounding Validator
↓
Clinical Consistency Guard
↓
Exact Topic Guard
↓
OUTPUT

MÓDULOS QUE DEVEM SER MAPEADOS

Tutor V3
Question Generator
Generate Adaptive Simulado
Professor Simulado
Question Explainer
Flashcards
Recovery
Mnemônicos
Clinical Simulation / Plantão
Professor tools
Planner quando gerar conteúdo médico
Process Upload / RAG

Não migrar todos em produção de uma vez.

Primeiro criar a camada comum e adapters shadow/feature flags.

PUBMED

Implementar integração backend usando NCBI E-utilities.

Não fazer scraping HTML.

Criar:

supabase/functions/_shared/pubmed-client.ts

Implementar:

searchPubMed()
fetchPubMedRecords()
fetchPubMedAbstracts()
linkPubMedToPMC()
fetchPMCMetadata()

Usar NCBI_API_KEY se existir.

Se não existir, operar dentro dos limites públicos permitidos.

PUBMED CENTRAL

Quando houver PMCID relacionado ao PMID:

full_text_available = true

Nunca assumir que todo artigo PubMed possui texto completo.

EVIDENCE RETRIEVAL TIERS

L1 — CACHE LOCAL
evidência já materializada

L2 — CORPUS INTERNO
literatura, guidelines, banco, GOLD, provas oficiais

L3 — LIVE RETRIEVAL
PubMed / PMC

Executar L3 somente quando:
- evidência local insuficiente
- tema novo
- informação potencialmente desatualizada
- conflito de evidência
- solicitação explícita de atualização científica

Não consultar PubMed a cada clique sem necessidade.

CANONICAL QUERY BUILDER

Toda busca deve partir do Canonical Topic Engine.

Exemplo:

IAM
→ acute myocardial infarction
→ myocardial infarction
→ STEMI
→ NSTEMI
→ acute coronary syndrome

Sibling blocker continua obrigatório.

Selecionar IAM não deve recuperar pericardite, miocardite ou insuficiência cardíaca como tema dominante.

EVIDENCE NORMALIZATION

Normalizar resultados em contrato comum:

{
  evidence_id,
  source_type,
  PMID,
  PMCID,
  DOI,
  title,
  abstract,
  publication_year,
  journal,
  study_type,
  canonical_topic,
  specialty,
  relevance_score,
  evidence_level,
  full_text_available,
  retrieved_at
}

Deduplicar por:

PMID
DOI
source_id

STUDY TYPE

Quando a metadata permitir, classificar:

guideline
systematic_review
meta_analysis
randomized_trial
cohort
case_control
cross_sectional
case_series
case_report
review
other

Não inventar tipo de estudo.

EVIDENCE HIERARCHY

Priorizar:

1. guideline atual
2. revisão sistemática/meta-análise
3. ensaio clínico
4. estudo observacional robusto
5. literatura de referência
6. PubMed abstract
7. provas oficiais
8. GOLD
9. banco validado

Um case report isolado não pode superar guideline ou revisão sistemática sem justificativa explícita.

CONFLICT ENGINE

Quando fontes relevantes divergirem:

EVIDENCE_CONFLICT = true

Registrar:

source_ids
claim
conflict_type
authority_difference

Não permitir que o modelo escolha silenciosamente uma fonte.

CONTEXT PACK

Criar função única:

buildMedicalEvidenceContext()

Entrada:

{
  userId?,
  module,
  specialty,
  topic,
  subtopic?,
  canonicalTopic,
  requestIntent,
  freshnessRequirement?
}

Saída:

{
  context_pack_id,
  context_hash,
  canonical_topic,
  aliases,
  evidence[],
  gold_questions[],
  official_exam_refs[],
  conflicts[],
  retrieval_confidence,
  freshness,
  created_at
}

Todos os providers devem receber exatamente o mesmo Context Pack.

CONTEXT HASH

O mesmo caso enviado a diferentes modelos precisa manter o mesmo:

context_hash

Se hashes diferirem:

BENCHMARK INVALID

GROUNDING

Toda afirmação clínica relevante deve ser rastreável para:

source_ids[]

Calcular:

grounding_score =
supported_clinical_claims / total_clinical_claims

Calcular também:

unsupported_claim_rate

Criar:

CRITICAL_HALLUCINATION

para claims não sustentados envolvendo:

diagnóstico
tratamento
dose
contraindicação
indicação
urgência
prognóstico
gabarito

HARD GATES

Se:

context pack vazio
→ FAIL

retrieval_confidence insuficiente
→ FAIL ou resposta com incerteza explícita

critical hallucination > 0
→ FAIL

unsupported_claim_rate > 0.05
→ FAIL

exact topic falhou
→ FAIL

sibling contamination
→ FAIL

answer key sem suporte
→ FAIL

QUESTION GENERATOR

Antes de gerar questão:
Evidence Context Pack obrigatório.

Depois da geração validar:

ANSWER_KEY_SUPPORTED
GROUNDING_SCORE
TOPIC_MATCH_SCORE
SIBLING_CONTAMINATION
JSON_VALID

Se qualquer hard gate falhar:

REJECT QUESTION

TUTOR

Antes da resposta médica:
Evidence Context Pack obrigatório.

A resposta deve citar internamente source_ids.

Se evidência insuficiente:
não responder com falsa certeza.

PLANTÃO

LLM usa Evidence Context Pack para diagnóstico e conduta pedagógica.

Deterministic Physiology Engine permanece independente.

A IA não pode sobrescrever sinais vitais determinísticos.

FLASHCARDS / MNEMÔNICOS / RECOVERY

Conteúdo médico também deve vir do Evidence Context Pack.

Tarefas puramente pedagógicas ou organizacionais podem usar rota mais leve, mas qualquer afirmação clínica deve ser grounded.

CEREBRAS HARDENING

Não usar reasoning como resposta final.

Implementar:

if content exists:
  COMPLETE

if content empty && reasoning exists:
  INCOMPLETE_GENERATION

if content empty && reasoning empty:
  EMPTY_GENERATION

Nunca mostrar reasoning interno ao usuário.

Retry com budget adequado.

Para zai-glm-4.7 em resposta clínica longa:

max_tokens >= 1000

Se continuar sem content final:

fallback.

PROVIDERS

Não alterar roteamento de produção nesta fase.

Manter candidatos atuais:

Gemini 2.5 Flash
GPT-5 Mini
NVIDIA Llama 3.1 8B
Cerebras gpt-oss-120b
Gemini 2.5 Pro

NVIDIA Llama 3.3 70B:
SHADOW ONLY

Claude Gateway:
DEGRADED / fora da cadeia crítica

TELEMETRIA

Registrar:

[MED_EVIDENCE_REQUEST]
[MED_EVIDENCE_CACHE_HIT]
[MED_EVIDENCE_INTERNAL_HIT]
[PUBMED_SEARCH_STARTED]
[PUBMED_SEARCH_COMPLETED]
[PMC_LINK_FOUND]
[EVIDENCE_CONTEXT_BUILT]
[EVIDENCE_CONFLICT_DETECTED]
[GROUNDING_VALIDATED]
[GROUNDING_REJECTED]

Guardar:

module
canonical_topic
context_pack_id
context_hash
evidence_count
pubmed_count
pmc_count
gold_count
retrieval_latency_ms
grounding_score
unsupported_claim_rate
critical_hallucination
topic_match_score

CACHE

Criar cache por:

canonical_topic
query_hash
retrieval_version
freshness_window

Evitar consultas repetitivas ao PubMed.

TESTES OBRIGATÓRIOS

Executar:

IAM
Sepse
TEP
Cetoacidose diabética pediátrica
Bronquiolite

Para cada caso validar:

Canonical Topic
Internal Retrieval
PubMed Retrieval
PMC Link quando disponível
Context Pack
Context Hash
Evidence Count
Retrieval Confidence
Sibling Contamination
Grounding

IAM deve bloquear como tema dominante:

Pericardite
Miocardite
Insuficiência Cardíaca

Não bloquear menção clínica legítima em diagnóstico diferencial quando necessária.

NÃO ALTERAR

Landing
Index
Dashboard público
ProductionObservation
roteamento global dos providers
RLS sem necessidade
banco de questões produtivo

Não transformar relatório técnico em home page.

NÃO PERSISTIR CONTEÚDO DE TESTE

Questões/respostas usadas em benchmark não entram em:

questions_bank
GOLD
simulados reais

SAÍDA OBRIGATÓRIA

WAR ROOM — EG-3 UNIFIED MEDICAL EVIDENCE SERVICE

Unified Evidence Service ........ PASS/FAIL
PubMed E-utilities .............. PASS/FAIL
PMC Linking ..................... PASS/FAIL
Canonical Query Builder ......... PASS/FAIL
Cache ........................... PASS/FAIL
PMID/DOI Dedup .................. PASS/FAIL
Evidence Hierarchy .............. PASS/FAIL
Conflict Engine ................. PASS/FAIL
Evidence Context Pack ........... PASS/FAIL
Context Hash .................... PASS/FAIL
Grounding Validator ............. PASS/FAIL
Exact Topic Guard ............... PASS/FAIL
Sibling Blocker ................. PASS/FAIL
Cerebras Final Content Guard .... PASS/FAIL
Production Routing Changed ...... NO

TESTES

IAM ............................. PASS/FAIL
Sepse ........................... PASS/FAIL
TEP ............................. PASS/FAIL
CAD Pediátrica .................. PASS/FAIL
Bronquiolite .................... PASS/FAIL

RESULTADO

Se tudo passar:

EG-3 EVIDENCE SERVICE CERTIFIED
READY FOR MODULE MIGRATION

Se houver falha:

EG-3 NOT CERTIFIED

informar:
component
expected
observed
root cause

REGRA FINAL

O conhecimento médico do ENAZIZI deve vir da Evidence Layer.

Gemini, GPT, NVIDIA, Cerebras ou qualquer outro LLM são motores substituíveis de raciocínio.

Nenhum LLM é fonte primária de conhecimento médico.`;

  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen whitespace-pre-wrap">
      {content}
    </div>
  );
}