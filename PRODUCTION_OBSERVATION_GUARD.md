# WAR ROOM — PRODUCTION OBSERVATION & GO-LIVE GUARD

## MISSÃO

Colocar o ENAZIZI em regime de **Production Observation** após a certificação da Reliability Hardening, preservando o estado validado do sistema e utilizando usuários reais como fonte principal para identificação de regressões.

Estado de referência:

```text
Reliability Hardening ........ CERTIFIED
P0 ........................... 0
P1 ........................... 0
Go-Live ...................... READY
```

O arquivo:

```text
FASE_2_CERTIFICATION_REPORT.md
```

passa a ser a baseline oficial de estabilidade.

---

# REGRA MESTRA

Durante esta fase:

```text
OBSERVAR > MODIFICAR
```

Proibido:

```text
❌ novas funcionalidades
❌ grandes refactors
❌ mudanças de arquitetura
❌ novos motores pedagógicos
❌ alterações cosméticas sem necessidade
❌ mudança de fórmulas certificadas
❌ mudança de métricas científicas
```

Permitido:

```text
✅ correção P0
✅ correção P1 comprovada
✅ observabilidade
✅ dogfood
✅ coleta de telemetria
✅ análise de produção
```

---

# PO-1 — PRODUCTION HEALTH

Monitorar continuamente:

```text
Frontend availability
Supabase availability
Edge Functions
AI Providers
Database
Cron Jobs
```

Indicadores:

```text
HTTP 5xx rate
HTTP 4xx inesperado
Failed to fetch
Timeout rate
AI provider failures
Circuit breaker activation
Edge boot errors
```

---

# PO-2 — TUTOR V3

Monitorar:

```text
requests
success rate
latency
provider
model
fallback rate
empty responses
topic accuracy
```

Alertar se:

```text
response vazia
fallback temático incorreto
topic mismatch
401 autenticado
5xx
latency excessiva
```

Eventos:

```text
[TUTOR_PRODUCTION_SUCCESS]
[TUTOR_PRODUCTION_FAILURE]
[TUTOR_TOPIC_MISMATCH]
[TUTOR_FALLBACK_USED]
```

Não criar eventos duplicados se já existirem equivalentes.

---

# PO-3 — SIMULADOS

Monitorar:

```text
generation success
topic adherence
duplicate rate
insufficientQuestions
completion rate
```

Especialmente:

```text
Exact Topic Mode
```

Validar continuamente:

```text
Sibling Leakage = 0
```

Para IAM:

```text
permitido:
IAM
SCA
STEMI
NSTEMI
aliases oficiais

proibido:
Pericardite
IC
Miocardite
Arritmias
Valvopatias
```

---

# PO-4 — FLASHCARDS / FSRS

Manter separação certificada:

```text
Acervo disponível
≠
FSRS materializado
≠
FSRS Due
```

Monitorar:

```text
available_cards
materialized_cards
due_cards
reviews_completed
fsrs_review_log
```

Regra:

```text
UI Due = DB Due
```

Qualquer divergência:

```text
P1
```

---

# PO-5 — RECOVERY LOOP

Monitorar fluxo:

```text
Erro
↓
Error Bank
↓
Recovery
↓
Flashcard
↓
FSRS
```

Indicadores:

```text
Recovery Success Rate
Pending Recoveries
Failed Recoveries
Average Recovery Time
```

Meta:

```text
>99%
```

Falha silenciosa:

```text
P1
```

---

# PO-6 — PLANNER

Monitorar:

```text
missões geradas
missões concluídas
medical_domain_map
FSRS integration
```

Detectar:

```text
missão vazia
missão repetida
tema incompatível
planner desatualizado
```

---

# PO-7 — MODO PLANTÃO

Monitorar:

```text
case creation
HDA
clinical actions
physiology engine
case completion
DQI
```

Detectar:

```text
Failed to fetch
motor fisiológico parado
sinais vitais incoerentes
IA contradizendo motor determinístico
```

---

# PO-8 — PROFESSOR

Monitorar:

```text
/professor
BI
alunos
métricas
simulados
resultados
```

Especialmente:

```text
professor-simulado
```

Alertar:

```text
401 inesperado
403 inesperado
500
502
503
```

---

# PO-9 — ADMIN

Monitorar:

```text
/admin
/admin/dogfood-monitor
/admin/alpha-cohort
/admin/official-outcomes
/admin/scientific-audit
```

Garantir:

```text
dados reais
zero placeholders
zero números artificiais
```

---

# PO-10 — ALPHA COHORT

ALPHA_2026 permanece ativa.

Meta:

```text
20 alunos inicialmente
50 posteriormente
```

Capturar somente:

```text
D0
D30
D60
D90
```

Manter guard-rails:

```text
❌ correlação
❌ effect size
❌ ranking
❌ aprovação agregada
❌ inferência causal
```

até autorização formal.

---

# PO-11 — OFFICIAL OUTCOMES

Continuar captura:

```text
student_reported
document_verified
institution_verified
```

Nunca apresentar:

```text
student_reported
```

como resultado oficialmente validado.

---

# PO-12 — AI PROVIDERS

Monitorar:

```text
Claude
OpenAI
Gemini
```

Registrar:

```text
provider
model
latency
success
fallback
cost
```

Circuit breaker deve permanecer ativo.

Não esconder fallback.

---

# PO-13 — COST MONITOR

Monitorar:

```text
AI calls
tokens
cache hits
RAG hits
fallbacks
cost per user
cost per Tutor session
cost per Simulado
```

Objetivo:

```text
AI somente quando agrega valor.
```

---

# PO-14 — DOGFOOD DIÁRIO

Executar diariamente smoke test:

```text
Login
↓
Dashboard
↓
Tutor
↓
Simulado
↓
Flashcard
↓
Planner
```

Sem alterar dados além do necessário ao teste controlado.

---

# PO-15 — DOGFOOD SEMANAL COMPLETO

Uma vez por semana executar:

```text
Aluno
Professor
Admin
```

Incluindo:

```text
Tutor
Simulado
Flashcards
Recovery
Planner
Plantão
Professor BI
Admin
```

---

# PO-16 — REGRESSION DETECTOR

Comparar comportamento atual com:

```text
FASE_2_CERTIFICATION_REPORT.md
```

Qualquer diferença relevante:

```text
[PRODUCTION_REGRESSION_DETECTED]
```

---

# CLASSIFICAÇÃO DE INCIDENTES

## P0

```text
segurança
perda de dados
auth bypass
sistema indisponível
corrupção pedagógica grave
```

Ação:

```text
HOTFIX IMEDIATO
```

## P1

```text
Tutor não responde
Simulado incorreto
FSRS errado
Planner quebrado
Recovery falha
```

Ação:

```text
HOTFIX CONTROLADO
```

## P2

```text
UX
latência moderada
inconsistência não bloqueante
```

Ação:

```text
BACKLOG
```

## P3

```text
warning
polish
dívida técnica
```

Ação:

```text
OBSERVAR
```

---

# CHANGE FREEZE

Toda mudança durante Production Observation deve responder:

```text
Existe bug reproduzível?
Existe evidência?
Qual severidade?
Qual impacto?
```

Sem evidência:

```text
NÃO ALTERAR
```

---

# HOTFIX PROTOCOL

Quando houver P0/P1:

```text
1. Reproduzir 2x
2. Capturar traceId
3. Identificar root cause
4. Criar menor fix possível
5. Testar isoladamente
6. Rodar regression suite
7. Deploy
8. Repetir jornada real
9. Comparar com baseline
```

---

# GO-LIVE HEALTH SCORE

Criar somente se já houver infraestrutura equivalente; não criar dashboard novo durante freeze.

Avaliar:

```text
Frontend
Edge
Tutor
Simulado
FSRS
Recovery
Planner
Plantão
Professor
```

Objetivo:

```text
P0 = 0
P1 = 0
```

---

# JANELA DE OBSERVAÇÃO

Primeira janela:

```text
14 dias
```

Durante esses 14 dias:

```text
ZERO FEATURES NOVAS
```

---

# GATE D7

Após 7 dias verificar:

```text
P0 encontrados
P1 encontrados
5xx rate
Tutor success
Simulado success
FSRS reviews
Recovery success
AI provider health
```

---

# GATE D14

Somente liberar próxima etapa se:

```text
P0 = 0

P1 aberto = 0

nenhuma regressão crítica

Tutor estável

Simulados estáveis

FSRS estável

Recovery estável

Plantão estável
```

---

# RELATÓRIO D14

Produzir:

```text
WAR ROOM — PRODUCTION OBSERVATION

Users Active .............. ?
Sessions .................. ?
Tutor Success ............. ?
Simulado Success .......... ?
FSRS Reviews .............. ?
Recovery Success .......... ?
Clinical Sessions ......... ?
P0 ........................ ?
P1 ........................ ?
P2 ........................ ?
P3 ........................ ?
```

---

# DECISÃO FINAL

Se os critérios forem atingidos:

```text
PRODUCTION STABILITY CERTIFIED
```

Então:

```text
Controlled Go-Live
↓
Alpha Cohort Expansion
↓
External Validation
```

Se houver P0/P1:

```text
PRODUCTION STABILITY NOT CERTIFIED
```

e manter freeze.

---

# OBJETIVO FINAL

Não provar que o código compila.

Não provar que os testes passam.

Provar que:

```text
PESSOAS REAIS
↓
USAM O ENAZIZI
↓
SEM ERROS CRÍTICOS
↓
COM DADOS CONSISTENTES
↓
COM RESULTADOS PEDAGÓGICOS RASTREÁVEIS
```

## REGRA ABSOLUTA

Durante Production Observation:

**não melhorar o que não está quebrado.**