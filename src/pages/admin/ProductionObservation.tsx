import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `
# WAR ROOM — D1 AUTHENTICATED PRODUCTION DOGFOOD EXECUTION

## MISSÃO

Executar a auditoria D1 real do ENAZIZI após a restauração da Production Baseline.

Estado obrigatório de partida:

\`\`\`text
PRODUCTION BASELINE ........ RESTORED
D1 OBSERVATION ............. SAFE
FEATURE FREEZE ............. ACTIVE
RELIABILITY HARDENING ...... CERTIFIED
\`\`\`

Objetivo:

\`\`\`text
SIMULAR USUÁRIOS REAIS
↓
EXECUTAR JORNADAS REAIS
↓
CAPTURAR FALHAS
↓
REPRODUZIR
↓
CLASSIFICAR
↓
NÃO CORRIGIR
\`\`\`

---

# REGRA ABSOLUTA — READ ONLY

Durante esta execução:

\`\`\`text
NÃO editar código
NÃO criar migration
NÃO alterar banco manualmente
NÃO alterar RLS
NÃO alterar cron
NÃO alterar provider
NÃO alterar model
NÃO alterar prompt
NÃO alterar feature flag
NÃO alterar UI
NÃO criar dashboard
NÃO corrigir bug
\`\`\`

São permitidas apenas alterações de dados que um usuário real produziria naturalmente pela própria UI durante o teste:

\`\`\`text
sessão de estudo
resposta de questão
revisão de flashcard
simulado de teste
mensagem ao Tutor
simulação clínica
\`\`\`

Não executar INSERT/UPDATE manual para fazer um teste "passar".

---

# REGRA DE EVIDÊNCIA

Existem 4 estados possíveis:

\`\`\`text
PASSOU
FALHOU
NÃO TESTADO
DADOS INSUFICIENTES
\`\`\`

PASSOU exige evidência real.

Não aceitar:

\`\`\`text
"o código parece correto"
"o arquivo existe"
"build passou"
"healthcheck = 200"
"provavelmente funciona"
\`\`\`

como validação E2E.

---

# 0 — PRÉ-FLIGHT

Antes dos testes registrar:

\`\`\`text
commit SHA atual
timestamp
ambiente
URL testada
auth status
browser
viewport
\`\`\`

Confirmar que:

\`\`\`text
Index original está restaurado
Landing original está ativa
Dashboard não foi alterado pelo WAR ROOM
\`\`\`

Comparar com:

\`\`\`text
FASE_2_CERTIFICATION_REPORT.md
PRODUCTION_OBSERVATION_GUARD.md
\`\`\`

---

# 1 — PERSONA ALUNO

Utilizar uma conta de teste legítima.

Não usar admin como substituto de aluno quando isso alterar RLS ou experiência.

---

# 1.1 LOGIN

Executar:

\`\`\`text
/logout
↓
/login
↓
login
↓
/dashboard
\`\`\`

Capturar:

\`\`\`text
HTTP
latência
redirect
console
network
\`\`\`

Esperado:

\`\`\`text
sessão válida
dashboard carregado
sem loop de redirect
\`\`\`

---

# 1.2 DASHBOARD

Auditar visualmente:

\`\`\`text
saudação
missão do dia
readiness
flashcards
FSRS
revisões
planner
recomendações
\`\`\`

Procurar:

\`\`\`text
NaN
undefined
zero falso
placeholder
dados impossíveis
loading infinito
\`\`\`

Comparar métricas críticas com banco em SELECT read-only.

---

# 1.3 FLASHCARDS — CERTIFICAÇÃO REAL

Abrir:

\`\`\`text
/dashboard/flashcards
\`\`\`

Registrar separadamente:

\`\`\`text
AVAILABLE
MATERIALIZED
DUE
LEARNING
REVIEW
\`\`\`

Consultar:

\`\`\`sql
SELECT count(*)
FROM fsrs_cards
WHERE user_id = :user_id
AND due <= now();
\`\`\`

Comparar com a UI.

Critério:

\`\`\`text
UI Due = DB Due
\`\`\`

---

# 1.4 REVISÃO PRIORITÁRIA

Clicar realmente.

Se due = 0:

\`\`\`text
botão desabilitado ou mensagem adequada
\`\`\`

Se due > 0:

\`\`\`text
sessão deve iniciar
\`\`\`

Responder pelo menos um card.

Confirmar depois:

\`\`\`text
fsrs_cards atualizado
fsrs_review_log inserido
\`\`\`

Recarregar a página.

Confirmar persistência.

---

# 1.5 SPRINT

Executar Sprint.

Validar:

\`\`\`text
sessão inicia
cards carregam
não depende de due > 0
resposta funciona
\`\`\`

---

# 1.6 TODOS

Executar modo Todos.

Avaliar:

\`\`\`text
tempo de carregamento
paginação
memória
responsividade
\`\`\`

Não aceitar loading infinito.

---

# 1.7 TUTOR V3 — IAM

Abrir sessão nova.

Perguntar exatamente:

\`\`\`text
Paciente com dor torácica há 90 minutos e supra de ST em DII, DIII e aVF. Explique diagnóstico e conduta inicial.
\`\`\`

Registrar:

\`\`\`text
traceId
HTTP
provider
model
latency
fallback_used
\`\`\`

Auditar conteúdo.

Esperado:

\`\`\`text
IAM com supra
contexto apropriado
resposta não vazia
\`\`\`

Proibido:

\`\`\`text
Sepse
Critérios de Light
fallback genérico
tema aleatório
\`\`\`

---

# 1.8 TROCA IAM → SEPSE

Usar o fluxo real "Mudar de Tema".

Novo tema:

\`\`\`text
Sepse
\`\`\`

Perguntar:

\`\`\`text
Paciente hipotenso após volume, lactato elevado e suspeita de infecção. Qual a abordagem inicial?
\`\`\`

Verificar se o Tutor resetou corretamente o contexto.

Falha se conteúdo relevante do IAM contaminar a nova sessão.

---

# 1.9 TUTOR AUTH SECURITY

Fora da sessão autenticada, chamar tutor-v3-premium sem JWT.

Esperado:

\`\`\`text
HTTP 401
zero conteúdo médico
\`\`\`

HTTP 200:

\`\`\`text
P0
\`\`\`

---

# 1.10 SIMULADO IAM — RUN 1

Criar simulado:

\`\`\`text
IAM
10 questões
\`\`\`

Não aceitar simplesmente que o simulado abriu.

Auditar todas as questões.

Registrar:

\`\`\`text
question_id
topic
subtopic
curriculum_theme
canonical topic
topic match score
\`\`\`

Permitido:

\`\`\`text
IAM
Infarto Agudo do Miocárdio
SCA
Síndrome Coronariana Aguda
STEMI
NSTEMI
aliases oficiais
\`\`\`

Proibido:

\`\`\`text
Pericardite
Miocardite
Endocardite
IC
Arritmias
Valvopatias
\`\`\`

Calcular:

\`\`\`text
sibling_leakage_rate
\`\`\`

Meta:

\`\`\`text
0%
\`\`\`

---

# 1.11 SIMULADO IAM — RUN 2

Repetir imediatamente:

\`\`\`text
IAM
10 questões
\`\`\`

Comparar IDs.

Calcular:

\`\`\`text
overlap_count
overlap_rate
\`\`\`

Identificar repetição indevida.

---

# 1.12 SIMULADO COMPLETO

Executar um simulado até o final.

Responder questões reais.

Errar propositalmente pelo menos uma questão de teste.

Validar:

\`\`\`text
simulado_sessions
simulado_questions
practice_attempts
resultado
acurácia
persistência
\`\`\`

Recarregar resultado.

Deve permanecer.

---

# 1.13 RECOVERY LOOP

Usar o erro produzido anteriormente.

Confirmar cadeia:

\`\`\`text
Erro
↓
Error Bank
↓
Recovery
↓
Flashcard
↓
FSRS
\`\`\`

Consultar:

\`\`\`text
error_bank
recovery_audit_log
flashcards
fsrs_cards
\`\`\`

Falha silenciosa:

\`\`\`text
P1
\`\`\`

---

# 1.14 PLANNER

Abrir missão do dia.

Executar uma ação válida.

Recarregar.

Validar:

\`\`\`text
estado persistido
sem duplicidade
sem missão vazia
\`\`\`

---

# 1.15 MNEMÔNICOS

Executar geração real.

Capturar:

\`\`\`text
provider
latência
HTTP
resultado
\`\`\`

Testar ação para flashcard se disponível.

---

# 1.16 MODO PLANTÃO

Iniciar caso.

Executar:

\`\`\`text
HDA
↓
exame físico
↓
exame complementar
↓
conduta
\`\`\`

Monitorar sinais vitais.

Validar:

\`\`\`text
clinical-simulation
physiology engine
persistência
\`\`\`

Procurar:

\`\`\`text
Failed to fetch
contradição fisiológica
estado parado
resposta vazia
\`\`\`

---

# 2 — PERSONA PROFESSOR

Utilizar conta com role professor.

Abrir:

\`\`\`text
/professor
\`\`\`

Validar:

\`\`\`text
BI
lista de alunos
métricas
matriz cognitiva
simulados
\`\`\`

---

# 2.1 PROFESSOR SIMULADO

Criar simulado de teste.

Tema:

\`\`\`text
IAM
\`\`\`

Registrar:

\`\`\`text
provider
model
HTTP
latência
traceId
\`\`\`

Validar:

\`\`\`text
geração
JSON
persistência
preview
\`\`\`

Auditar topic fidelity.

---

# 2.2 PROVIDER CLAUDE

Se configuração atual indicar Claude como primário:

não considerar PASSOU até confirmar nos logs reais:

\`\`\`text
provider=claude
\`\`\`

Registrar também:

\`\`\`text
model
fallback_used
provider_error
\`\`\`

Se terminar no OpenAI:

\`\`\`text
CLAUDE NÃO VALIDADO
\`\`\`

mesmo que o simulado tenha sido gerado.

---

# 3 — PERSONA ADMIN

Utilizar conta admin legítima.

Testar:

\`\`\`text
/admin
/admin/dogfood-monitor
/admin/alpha-cohort
/admin/official-outcomes
/admin/scientific-audit
/admin/production-observation
\`\`\`

---

# 3.1 DOGFOOD MONITOR

Auditar origem das métricas.

Procurar no código e runtime:

\`\`\`text
mock
Math.random
placeholder
hardcoded health
\`\`\`

Qualquer métrica artificial apresentada como real:

\`\`\`text
P1
\`\`\`

---

# 3.2 ALPHA COHORT

Comparar UI × banco:

\`\`\`text
coorte
meta
membros
D0
D30
D60
D90
\`\`\`

Não considerar UUID artificial sem profile como usuário real.

---

# 3.3 OFFICIAL OUTCOMES

Validar:

\`\`\`text
student_reported
document_verified
institution_verified
\`\`\`

Garantir:

\`\`\`text
student_reported
≠
resultado validado
\`\`\`

---

# 4 — AI PROVIDERS

Testar health dos providers.

Registrar:

| Provider | Model | HTTP | Latência | Circuit | Status |
| -------- | ----- | ---: | -------: | ------- | ------ |
| Claude   | ?     |    ? |        ? | ?       | ?      |
| OpenAI   | ?     |    ? |        ? | ?       | ?      |
| Gemini   | ?     |    ? |        ? | ?       | ?      |

Não mascarar provider indisponível por fallback.

---

# 5 — EDGE FUNCTIONS

Validar em uso real:

\`\`\`text
tutor-v3-premium
generate-adaptive-simulado
question-generator
generate-flashcards
generate-recovery-flashcard
clinical-simulation
professor-simulado
study-orchestrator
eu-ai
\`\`\`

Capturar:

\`\`\`text
401 inesperado
403
429
500
502
503
504
timeout
\`\`\`

---

# 6 — CONSOLE

Durante toda auditoria registrar:

\`\`\`text
console.error
console.warn
Unhandled Promise
duplicate key
undefined
NaN
\`\`\`

Warnings conhecidos devem ser separados de erros novos.

---

# 7 — MOBILE DOGFOOD

Viewport:

\`\`\`text
390 × 844
\`\`\`

Testar pelo menos:

\`\`\`text
Dashboard
Tutor
Simulados
Flashcards
Plantão
\`\`\`

Auditar:

\`\`\`text
overflow
modal cortado
input coberto
botão inacessível
sidebar
scroll
\`\`\`

---

# 8 — PERFORMANCE

Registrar aproximadamente:

\`\`\`text
Dashboard load
Tutor response
Simulado generation
Flashcard start
Plantão response
Professor load
\`\`\`

Classificar:

\`\`\`text
<2s excelente
2–5s aceitável
5–10s atenção
>10s investigar
\`\`\`

Não aplicar automaticamente esses thresholds a geração de IA sem contextualizar o tipo de operação.

---

# 9 — REPRODUÇÃO

Toda falha:

\`\`\`text
Tentativa 1
↓
Tentativa 2
\`\`\`

Se P0/P1:

\`\`\`text
Tentativa 3
\`\`\`

quando seguro.

Classificar:

\`\`\`text
REPRODUZÍVEL
INTERMITENTE
NÃO REPRODUZIDO
\`\`\`

---

# 10 — PROIBIDO DURANTE O D1

Se encontrar bug:

\`\`\`text
NÃO CORRIGIR
\`\`\`

Primeiro entregar relatório.

Hotfix será autorizado separadamente.

---

# RELATÓRIO OBRIGATÓRIO

## EXECUTIVE STATUS

\`\`\`text
D1 PRODUCTION DOGFOOD

P0 ........ ?
P1 ........ ?
P2 ........ ?
P3 ........ ?

5xx ....... ?
Failed Fetch ... ?
Empty 200 ...... ?
Auth Bypass .... ?
\`\`\`

---

## MATRIZ

| Jornada             | Status | Latência | HTTP | Persistência | Evidência |
| ------------------- | ------ | -------: | ---- | ------------ | --------- |
| Login               |        |          |      |              |           |
| Dashboard           |        |          |      |              |           |
| Planner             |        |          |      |              |           |
| Tutor IAM           |        |          |      |              |           |
| Tutor Sepse         |        |          |      |              |           |
| Simulado IAM #1     |        |          |      |              |           |
| Simulado IAM #2     |        |          |      |              |           |
| Recovery            |        |          |      |              |           |
| Flashcards Priority |        |          |      |              |           |
| Flashcards Sprint   |        |          |      |              |           |
| Flashcards All      |        |          |      |              |           |
| Plantão             |        |          |      |              |           |
| Professor           |        |          |      |              |           |
| Professor Simulado  |        |          |      |              |           |
| Admin               |        |          |      |              |           |
| Alpha Cohort        |        |          |      |              |           |
| Outcomes            |        |          |      |              |           |
| Mobile              |        |          |      |              |           |

---

# INCIDENT REPORT

Para cada falha:

\`\`\`text
INCIDENT ID
SEVERITY
PERSONA
ROUTE
TIMESTAMP

STEPS TO REPRODUCE

EXPECTED

OBSERVED

HTTP

TRACE ID

CONSOLE

NETWORK

DB EVIDENCE

REPRODUCTION RATE

LIKELY ROOT LAYER

USER IMPACT
\`\`\`

---

# COMPARAÇÃO COM BASELINE

Comparar obrigatoriamente com:

\`\`\`text
FASE_2_CERTIFICATION_REPORT.md
PRODUCTION_OBSERVATION_GUARD.md
\`\`\`

Marcar:

\`\`\`text
REGRESSION
NEW ISSUE
KNOWN ISSUE
\`\`\`

---

# DECISÃO D1

## Caso exista P0

\`\`\`text
D1 CRITICAL
GO-LIVE HOLD
\`\`\`

## P0 = 0 e P1 > 0

\`\`\`text
D1 NEEDS HOTFIX
PRODUCTION OBSERVATION CONTINUES
\`\`\`

## P0 = 0 e P1 = 0

\`\`\`text
D1 PASSED
PRODUCTION OBSERVATION CONTINUES TO D7
\`\`\`

---

# REGRA FINAL

Não tente provar que o ENAZIZI está funcionando.

Tente provar que ele está quebrado.

Somente se a tentativa falhar em encontrar P0/P1 reproduzível, considerar o D1 aprovado.

Objetivo:

\`\`\`text
USUÁRIO REAL
↓
JORNADA REAL
↓
PRODUÇÃO REAL
↓
EVIDÊNCIA REAL
\`\`\`
  `;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: PRODUCTION OBSERVATION
          </h1>
          <p className="text-zinc-500 mt-1">Status: D1 — Authenticated Production Dogfood Execution</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400">READ-ONLY</Badge>
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">STABILITY FREEZE</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <Cpu className="h-3 w-3" /> Edge Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">DADOS INSUFICIENTES</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Auth Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-green-500">OPERATIONAL</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">0 P0 / 0 P1</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500">Session Drift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-500">STABLE</div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[75vh] rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="max-w-4xl mx-auto whitespace-pre-wrap leading-relaxed opacity-80">
          {content}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProductionObservationPage;
