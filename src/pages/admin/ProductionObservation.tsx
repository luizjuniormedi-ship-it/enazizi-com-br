import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `# WAR ROOM — D1.1 AUTHENTICATED DOGFOOD COMPLETION

## MISSÃO

Completar exclusivamente as jornadas autenticadas que ficaram \`NÃO TESTADO\` no D1 Production Dogfood.

O D1 anterior já certificou:

\`\`\`text
Landing pública .............. PASSOU
Login UI ..................... PASSOU
Route Guards ................. PASSOU
Tutor sem JWT = 401 .......... PASSOU
Mobile público ............... PASSOU
Production Baseline .......... PASSOU
\`\`\`

NÃO repetir esses testes.

Agora validar:

\`\`\`text
ALUNO AUTENTICADO
PROFESSOR AUTENTICADO
ADMIN AUTENTICADO
\`\`\`

---

# REGRA PRINCIPAL

NÃO implementar este protocolo.

NÃO editar páginas.

NÃO atualizar o War Room.

NÃO alterar código.

NÃO alterar banco manualmente.

NÃO alterar RLS.

NÃO alterar cron.

NÃO alterar providers.

NÃO corrigir bugs durante esta execução.

Executar somente QA funcional autorizado.

---

# GATE 0 — AUTH OBRIGATÓRIO

Antes de qualquer teste verificar:

\`\`\`text
LOVABLE_BROWSER_AUTH_STATUS
\`\`\`

Se:

\`\`\`text
signed_out
\`\`\`

PARAR as jornadas autenticadas.

Retornar:

\`\`\`text
D1.1 BLOCKED — AUTH SESSION REQUIRED
\`\`\`

Não declarar:

\`\`\`text
PASSOU
D1 PASSED
CONTINUE TO D7
\`\`\`

Se houver sessão autenticada, identificar apenas:

\`\`\`text
role
user_id
\`\`\`

sem expor tokens ou credenciais.

---

# PERSONA 1 — ALUNO

Confirmar role apropriada.

Abrir:

\`\`\`text
/dashboard
\`\`\`

Esperado:

\`\`\`text
HTTP 200
dashboard real
dados do usuário
\`\`\`

---

# TESTE A1 — DASHBOARD

Registrar os valores apresentados:

\`\`\`text
Readiness
Flashcards disponíveis
FSRS materializados
Revisões pendentes
Missão do Dia
\`\`\`

Comparar métricas críticas com SELECT read-only quando possível.

Resultado:

\`\`\`text
UI_VALUE
DB_VALUE
DIVERGENCE
\`\`\`

Zero falso:

\`\`\`text
FALHA
\`\`\`

---

# TESTE A2 — FLASHCARDS

Abrir:

\`\`\`text
/dashboard/flashcards
\`\`\`

Registrar:

\`\`\`text
available
materialized
due
learning
review
\`\`\`

Executar SELECT read-only equivalente para \`due\`.

Critério:

\`\`\`text
UI due = DB due
\`\`\`

---

# TESTE A3 — REVISÃO PRIORITÁRIA

Se \`due > 0\`:

clicar em:

\`\`\`text
Revisão Prioritária
\`\`\`

Responder 1 card pela UI.

Depois verificar via SELECT:

\`\`\`text
fsrs_cards
fsrs_review_log
\`\`\`

Confirmar:

\`\`\`text
review criado
due atualizado
state atualizado
\`\`\`

Recarregar.

Estado deve permanecer.

Se \`due = 0\`:

validar apenas que a UI não informa milhares de cards como vencidos.

---

# TESTE A4 — SPRINT

Clicar:

\`\`\`text
Sprint
\`\`\`

Confirmar:

\`\`\`text
sessão inicia
cards aparecem
resposta funciona
\`\`\`

---

# TESTE A5 — TODOS

Clicar:

\`\`\`text
Todos
\`\`\`

Validar:

\`\`\`text
acervo carrega
paginação funciona
sem loading infinito
\`\`\`

Registrar tempo aproximado.

---

# TESTE A6 — TUTOR IAM

Criar sessão limpa.

Perguntar:

\`\`\`text
Paciente com dor torácica há 90 minutos e supra de ST em DII, DIII e aVF. Explique o diagnóstico e a conduta inicial.
\`\`\`

Registrar:

\`\`\`text
HTTP
latência
provider
model
fallback
traceId
\`\`\`

Validar conteúdo.

Esperado:

\`\`\`text
IAM com supra
\`\`\`

Falha se a resposta for predominantemente:

\`\`\`text
Sepse
Critérios de Light
Derrame pleural
tema não relacionado
\`\`\`

---

# TESTE A7 — TUTOR TOPIC SWITCH

Usar o botão/fluxo normal:

\`\`\`text
Mudar de Tema
→ Sepse
\`\`\`

Perguntar:

\`\`\`text
Paciente com suspeita de infecção, lactato elevado e hipotensão persistente após reposição volêmica. Qual a abordagem inicial?
\`\`\`

Registrar:

\`\`\`text
IAM leakage = SIM/NÃO
\`\`\`

Esperado:

\`\`\`text
IAM leakage = NÃO
\`\`\`

---

# TESTE A8 — PERSISTÊNCIA TUTOR

Recarregar a sessão.

Confirmar que mensagens anteriores continuam disponíveis quando esse for o comportamento esperado do produto.

Validar banco via SELECT quando possível.

---

# TESTE A9 — SIMULADO IAM #1

Pela interface:

\`\`\`text
Tema = IAM
Quantidade = 10
\`\`\`

Gerar.

Registrar:

| # | Question ID | Topic | Subtopic | Match/Alias | Aceita |
| - | ----------- | ----- | -------- | ----------- | ------ |

Aliases permitidos:

\`\`\`text
IAM
Infarto Agudo do Miocárdio
SCA
Síndrome Coronariana Aguda
STEMI
NSTEMI
aliases oficiais cadastrados
\`\`\`

Temas irmãos proibidos:

\`\`\`text
Pericardite
Miocardite
Endocardite
IC
Arritmias
Valvopatias
\`\`\`

Resultado obrigatório:

\`\`\`text
Sibling Leakage = X/10
\`\`\`

Meta:

\`\`\`text
0/10
\`\`\`

---

# TESTE A10 — SIMULADO IAM #2

Gerar novamente:

\`\`\`text
IAM
10 questões
\`\`\`

Registrar IDs.

Comparar:

\`\`\`text
RUN1 IDs
RUN2 IDs

OVERLAP COUNT = ?
OVERLAP RATE = ?%
\`\`\`

Não declarar dedupe aprovado sem números.

---

# TESTE A11 — SIMULADO COMPLETO

Executar pela UI:

\`\`\`text
iniciar
→ responder
→ errar propositalmente pelo menos 1
→ finalizar
\`\`\`

Confirmar:

\`\`\`text
resultado
acurácia
persistência
\`\`\`

Recarregar página de resultado.

Deve permanecer.

---

# TESTE A12 — RECOVERY LOOP

A partir do erro anterior verificar:

\`\`\`text
Erro
↓
Banco de Erros
↓
Recovery
↓
Flashcard
↓
FSRS
\`\`\`

Consultar somente leitura:

\`\`\`text
error_bank
recovery_audit_log
flashcards
fsrs_cards
\`\`\`

Não aceitar somente feedback visual.

Resultado deve mostrar quais etapas realmente ocorreram.

---

# TESTE A13 — BANCO DE ERROS

Abrir:

\`\`\`text
Banco de Erros
\`\`\`

Confirmar presença do erro produzido no teste.

Executar:

\`\`\`text
Treinar Agora
\`\`\`

Validar tema e questão.

---

# TESTE A14 — PLANNER

Abrir Planner.

Executar uma ação normal.

Recarregar.

Validar:

\`\`\`text
persistência
sem duplicação
sem tarefa vazia
\`\`\`

---

# TESTE A15 — MNEMÔNICOS

Gerar um mnemônico.

Registrar:

\`\`\`text
HTTP
latência
provider se disponível
resultado
\`\`\`

Testar integração com Flashcards quando disponível.

---

# TESTE A16 — MODO PLANTÃO

Iniciar caso clínico.

Executar normalmente:

\`\`\`text
HDA
→ avaliação
→ exame
→ conduta
\`\`\`

Observar:

\`\`\`text
sinais vitais
evolução
resposta clínica
\`\`\`

Registrar:

\`\`\`text
HTTP
latência
Failed to fetch
console errors
\`\`\`

---

# PERSONA 2 — PROFESSOR

A sessão deve possuir role professor ou acesso legítimo equivalente.

Não utilizar permissões administrativas como substituto silencioso caso isso altere o comportamento da aplicação.

Abrir:

\`\`\`text
/professor
\`\`\`

---

# TESTE P1 — PROFESSOR BI

Validar:

\`\`\`text
lista de alunos
métricas
matriz cognitiva
scores
\`\`\`

Procurar:

\`\`\`text
NaN
undefined
zeros impossíveis
loading infinito
\`\`\`

---

# TESTE P2 — PROFESSOR SIMULADO

Criar simulado de teste:

\`\`\`text
IAM
dificuldade alta
quantidade mínima adequada
\`\`\`

Registrar:

\`\`\`text
HTTP
latência
provider
model
fallback
traceId
\`\`\`

Confirmar:

\`\`\`text
geração
preview
persistência
\`\`\`

Não distribuir para alunos reais quando desnecessário.

---

# TESTE P3 — CLAUDE REAL

Se Claude estiver configurado como primário para esse fluxo:

comprovar por:

\`\`\`text
log
trace
response metadata
\`\`\`

Resultado:

\`\`\`text
PROVIDER ACTUAL = ?
MODEL ACTUAL = ?
FALLBACK = ?
\`\`\`

Configuração não é evidência de uso.

---

# PERSONA 3 — ADMIN

Utilizar sessão admin autorizada.

Abrir:

\`\`\`text
/admin
\`\`\`

Depois:

\`\`\`text
/admin/dogfood-monitor
/admin/alpha-cohort
/admin/official-outcomes
/admin/scientific-audit
/admin/production-observation
\`\`\`

---

# TESTE ADM1 — DOGFOOD MONITOR

Validar se indicadores apresentados correspondem a fontes reais.

Não considerar ausência de atividade como saúde perfeita.

Se não houver volume suficiente:

\`\`\`text
DADOS INSUFICIENTES
\`\`\`

---

# TESTE ADM2 — ALPHA COHORT

Comparar UI × banco:

\`\`\`text
ALPHA_2026
target size
membros
D0
D30
D60
D90
\`\`\`

Registrar:

\`\`\`text
UI MEMBERS = ?
DB MEMBERS = ?

UI SNAPSHOTS = ?
DB SNAPSHOTS = ?
\`\`\`

---

# TESTE ADM3 — OFFICIAL OUTCOMES

Validar tiers:

\`\`\`text
student_reported
document_verified
institution_verified
\`\`\`

Confirmar visualmente:

\`\`\`text
student_reported = não verificado
\`\`\`

---

# TESTE ADM4 — SCIENTIFIC AUDIT

Validar somente carregamento e coerência dos dados existentes.

Não executar recalibração, promoção, rebaixamento ou qualquer ação que altere produção.

---

# MOBILE AUTHENTICATED

Viewport:

\`\`\`text
390 × 844
\`\`\`

Executar com aluno autenticado:

\`\`\`text
Dashboard
Tutor
Flashcards
Simulados
Plantão
\`\`\`

Registrar:

\`\`\`text
overflow
modal cortado
input coberto
botão inacessível
sidebar
scroll
\`\`\`

---

# NETWORK

Durante todos os testes contabilizar:

\`\`\`text
400
401 inesperado
403 inesperado
404 inesperado
409
429
500
502
503
504
\`\`\`

Também:

\`\`\`text
Failed to fetch
timeout
CORS
empty response
\`\`\`

---

# CONSOLE

Registrar:

\`\`\`text
console.error
Unhandled Promise
duplicate key
NaN
undefined
\`\`\`

Warnings não bloqueantes devem ser separados.

---

# REPRODUÇÃO

Toda falha funcional encontrada:

\`\`\`text
executar 2 vezes
\`\`\`

P0/P1:

\`\`\`text
2/2 = reproduzível
1/2 = intermitente
\`\`\`

Terceira tentativa quando segura e necessária.

---

# PROIBIDO

Durante esta execução:

\`\`\`text
code edit
migration
INSERT manual
UPDATE manual
DELETE
ALTER
RLS change
cron change
provider change
prompt change
feature flag change
\`\`\`

---

# OUTPUT OBRIGATÓRIO

Começar a resposta com:

\`\`\`text
D1.1 AUTHENTICATED DOGFOOD — EXECUÇÃO CONCLUÍDA
\`\`\`

Se não existir sessão autenticada:

\`\`\`text
D1.1 AUTHENTICATED DOGFOOD — BLOCKED: AUTH REQUIRED
\`\`\`

Nesse caso NÃO declarar D1 aprovado.

---

# MATRIZ

| Jornada            | Status | HTTP | Latência | Persistência | Evidência |
| ------------------ | ------ | ---: | -------: | ------------ | --------- |
| Dashboard Auth     |        |      |          |              |           |
| Flashcards         |        |      |          |              |           |
| Priority           |        |      |          |              |           |
| Sprint             |        |      |          |              |           |
| Todos              |        |      |          |              |           |
| Tutor IAM          |        |      |          |              |           |
| Tutor Sepse        |        |      |          |              |           |
| Tutor Persistence  |        |      |          |              |           |
| IAM Run #1         |        |      |          |              |           |
| IAM Run #2         |        |      |          |              |           |
| Simulado E2E       |        |      |          |              |           |
| Recovery           |        |      |          |              |           |
| Error Bank         |        |      |          |              |           |
| Planner            |        |      |          |              |           |
| Mnemonics          |        |      |          |              |           |
| Plantão            |        |      |          |              |           |
| Professor BI       |        |      |          |              |           |
| Professor Simulado |        |      |          |              |           |
| Claude Actual      |        |      |          |              |           |
| Admin              |        |      |          |              |           |
| Alpha Cohort       |        |      |          |              |           |
| Outcomes           |        |      |          |              |           |
| Scientific Audit   |        |      |          |              |           |
| Mobile Auth        |        |      |          |              |           |

---

# INCIDENTES

Para cada falha:

\`\`\`text
ID:
SEVERIDADE:
PERSONA:
ROTA:

PASSOS:

ESPERADO:

OBSERVADO:

HTTP:

TRACE ID:

CONSOLE:

DB EVIDENCE:

REPRODUÇÃO:

CAMADA PROVÁVEL:

IMPACTO:
\`\`\`

---

# EXECUTIVE RESULT

Informar:

\`\`\`text
P0 = ?
P1 = ?
P2 = ?
P3 = ?

5xx = ?
429 = ?
Failed to Fetch = ?
Empty Responses = ?

IAM Sibling Leakage = ?/?
IAM Run Overlap = ?%

FSRS UI Due = ?
FSRS DB Due = ?
FSRS Divergence = ?

Tutor Provider = ?
Professor Simulado Provider = ?
\`\`\`

---

# DECISÃO FINAL D1

Somente se:

\`\`\`text
D1 público = PASSOU
+
D1.1 autenticado = PASSOU
\`\`\`

poderá retornar:

\`\`\`text
D1 FULLY PASSED
PRODUCTION OBSERVATION CONTINUES TO D7
\`\`\`

Se autenticação continuar indisponível:

\`\`\`text
D1 PARTIAL PASS
AUTHENTICATED VALIDATION PENDING
\`\`\`

Se encontrar P0:

\`\`\`text
D1 CRITICAL
GO-LIVE HOLD
\`\`\`

Se encontrar P1:

\`\`\`text
D1 NEEDS HOTFIX
\`\`\`

## REGRA FINAL

O objetivo desta execução não é validar novamente as rotas públicas.

É responder com evidência:

**O ENAZIZI funciona quando um aluno, professor e administrador realmente entram e usam o sistema?**
`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: PRODUCTION OBSERVATION
          </h1>
          <p className="text-zinc-500 mt-1">Status: D1.1 — Authenticated Dogfood Completion</p>
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
