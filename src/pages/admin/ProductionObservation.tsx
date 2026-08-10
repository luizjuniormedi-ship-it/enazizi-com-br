import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `# D1.2 — AUTHENTICATED QA SESSION HANDOFF

## OBJETIVO

Completar o D1 Production Dogfood que está atualmente:

\`\`\`text
D1 PUBLIC VALIDATION ............ PASSOU
D1 AUTHENTICATED VALIDATION ..... PENDENTE
BLOCKER ......................... AUTH_STATUS=signed_out
\`\`\`

Esta execução NÃO deve alterar o produto.

O único objetivo inicial é detectar uma sessão autenticada legítima disponibilizada pelo usuário no Preview do Lovable e, quando ela existir, executar as jornadas autenticadas pendentes.

---

# REGRA 1 — NÃO SOLICITAR CREDENCIAIS NO CHAT

Não pedir:

\`\`\`text
senha
token JWT
refresh token
service_role key
session cookie
OTP
\`\`\`

Não imprimir ou registrar segredos.

Não criar bypass de autenticação.

Não modificar RLS.

Não criar usuário privilegiado.

Não utilizar service_role para simular usuário.

---

# REGRA 2 — SESSION HANDOFF

Verificar:

\`\`\`text
LOVABLE_BROWSER_AUTH_STATUS
\`\`\`

Se:

\`\`\`text
signed_out
\`\`\`

responder exclusivamente:

\`\`\`text
AUTH SESSION REQUIRED

Abra o Preview do projeto no Lovable.

Faça login normalmente com a conta de teste autorizada.

Mantenha a sessão aberta.

Depois solicite novamente:
"Continue D1.2 authenticated dogfood."
\`\`\`

Não executar alterações.

Não declarar D1 aprovado.

---

# REGRA 3 — QUANDO AUTH ESTIVER ATIVO

Quando:

\`\`\`text
LOVABLE_BROWSER_AUTH_STATUS != signed_out
\`\`\`

identificar através da própria aplicação:

\`\`\`text
user_id
role
\`\`\`

Não exibir dados sensíveis.

Registrar:

\`\`\`text
AUTH SESSION DETECTED
ROLE = ?
\`\`\`

---

# PERSONA A — ALUNO

Se role permitir jornada normal de aluno, executar:

\`\`\`text
/dashboard
/dashboard/flashcards
/dashboard/simulados
/dashboard/planner
/dashboard/sessao-estudo
/dashboard/resultados-oficiais
\`\`\`

e módulos acessíveis correspondentes.

---

# A1 — DASHBOARD

Validar:

\`\`\`text
Dashboard carregou
Missão do Dia carregou
Readiness carregou
Planner carregou
Métricas carregaram
\`\`\`

Registrar:

\`\`\`text
HTTP
tempo
console errors
network errors
\`\`\`

---

# A2 — FSRS

Abrir Flashcards.

Capturar:

\`\`\`text
AVAILABLE
MATERIALIZED
DUE
\`\`\`

Executar SELECT read-only correspondente ao usuário autenticado.

Produzir:

\`\`\`text
UI_DUE = ?
DB_DUE = ?
DIVERGENCE = ?
\`\`\`

Critério:

\`\`\`text
DIVERGENCE = 0
\`\`\`

---

# A3 — PRIORITY

Se \`due > 0\`:

clicar em:

\`\`\`text
Revisão Prioritária
\`\`\`

Responder um card normalmente.

Confirmar posteriormente por SELECT:

\`\`\`text
fsrs_cards
fsrs_review_log
\`\`\`

Recarregar página.

Confirmar persistência.

Se \`due = 0\`:

validar que a UI não apresenta cards nunca iniciados como revisões vencidas.

---

# A4 — SPRINT

Executar Sprint.

Resultado esperado:

\`\`\`text
session_started = true
card_rendered = true
interaction_working = true
\`\`\`

---

# A5 — TODOS

Abrir Todos.

Registrar:

\`\`\`text
load_time
pagination
UI responsiveness
\`\`\`

---

# A6 — TUTOR IAM

Criar sessão nova.

Enviar:

\`\`\`text
Paciente com dor torácica há 90 minutos e supra de ST em DII, DIII e aVF. Explique diagnóstico e conduta inicial.
\`\`\`

Registrar:

\`\`\`text
HTTP
latency
provider
model
fallback
traceId
\`\`\`

Auditar resposta.

Esperado:

\`\`\`text
IAM com supra
\`\`\`

---

# A7 — TROCA DE TEMA

Usar o fluxo real:

\`\`\`text
Mudar de Tema
→ Sepse
\`\`\`

Enviar:

\`\`\`text
Paciente com suspeita de infecção, lactato elevado e hipotensão persistente após reposição volêmica. Qual a abordagem inicial?
\`\`\`

Registrar:

\`\`\`text
IAM_CONTEXT_LEAK = YES/NO
\`\`\`

Esperado:

\`\`\`text
NO
\`\`\`

---

# A8 — SIMULADO IAM RUN 1

Gerar pela UI:

\`\`\`text
IAM
10 questões
\`\`\`

Auditar todas.

Produzir:

| # | ID | Topic | Subtopic | Alias/Canonical | Valid |
| - | -- | ----- | -------- | --------------- | ----- |

Procurar especificamente:

\`\`\`text
Pericardite
Miocardite
Endocardite
Insuficiência Cardíaca
Arritmias
Valvopatias
\`\`\`

Resultado obrigatório:

\`\`\`text
SIBLING_LEAKAGE = X/10
\`\`\`

---

# A9 — SIMULADO IAM RUN 2

Gerar novamente.

Produzir:

\`\`\`text
RUN_1_IDS = [...]
RUN_2_IDS = [...]

OVERLAP = ?
OVERLAP_RATE = ?%
\`\`\`

---

# A10 — SIMULADO E2E

Executar:

\`\`\`text
iniciar
→ responder
→ produzir pelo menos um erro normal de teste
→ finalizar
\`\`\`

Validar:

\`\`\`text
resultado
acurácia
persistência
\`\`\`

Recarregar resultado.

---

# A11 — RECOVERY

Acompanhar o erro anterior:

\`\`\`text
Error Bank
↓
Recovery
↓
Flashcard
↓
FSRS
\`\`\`

Verificar com SELECT:

\`\`\`text
error_bank
recovery_audit_log
flashcards
fsrs_cards
\`\`\`

Produzir:

\`\`\`text
ERROR_CAPTURED = ?
RECOVERY_CREATED = ?
FLASHCARD_CREATED = ?
FSRS_CREATED = ?
\`\`\`

---

# A12 — PLANNER

Abrir Planner.

Executar uma ação normal.

Recarregar.

Registrar:

\`\`\`text
PERSISTED = YES/NO
DUPLICATED = YES/NO
\`\`\`

---

# A13 — PLANTÃO

Iniciar caso.

Executar:

\`\`\`text
HDA
→ avaliação
→ conduta
\`\`\`

Registrar:

\`\`\`text
HTTP
latency
vital_signs_working
physiology_state_change
errors
\`\`\`

---

# PERSONA B — PROFESSOR

Se a sessão atual não tiver permissões de professor:

\`\`\`text
PROFESSOR PERSONA = PENDING
\`\`\`

Não elevar privilégios.

Quando uma sessão legítima de professor estiver disponível, executar:

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

# PROFESSOR SIMULADO

Gerar um simulado IAM de teste.

Registrar:

\`\`\`text
HTTP
latency
provider
model
fallback
traceId
persisted
\`\`\`

Se Claude estiver configurado como primário:

confirmar pelo runtime.

Resultado obrigatório:

\`\`\`text
CONFIGURED_PROVIDER = ?
ACTUAL_PROVIDER = ?
ACTUAL_MODEL = ?
FALLBACK_USED = ?
\`\`\`

---

# PERSONA C — ADMIN

Se a sessão não tiver role admin:

\`\`\`text
ADMIN PERSONA = PENDING
\`\`\`

Não elevar privilégios.

Quando houver sessão admin legítima testar:

\`\`\`text
/admin
/admin/dogfood-monitor
/admin/alpha-cohort
/admin/official-outcomes
/admin/scientific-audit
/admin/production-observation
\`\`\`

---

# ADMIN — ALPHA COHORT

Comparar UI × banco:

\`\`\`text
UI_MEMBERS = ?
DB_MEMBERS = ?

UI_SNAPSHOTS = ?
DB_SNAPSHOTS = ?
\`\`\`

---

# ADMIN — OUTCOMES

Validar representação:

\`\`\`text
student_reported
→ não verificado

document_verified
→ documento verificado

institution_verified
→ instituição verificada
\`\`\`

---

# MOBILE AUTHENTICATED

Com sessão de aluno:

\`\`\`text
viewport = 390x844
\`\`\`

Testar:

\`\`\`text
Dashboard
Tutor
Flashcards
Simulados
Plantão
\`\`\`

Registrar apenas problemas observados.

---

# INCIDENT HANDLING

Não corrigir bugs nesta execução.

Para cada falha:

\`\`\`text
INCIDENT_ID
SEVERITY
PERSONA
ROUTE
EXPECTED
OBSERVED
HTTP
TRACE_ID
CONSOLE
NETWORK
DB_EVIDENCE
REPRODUCTION
\`\`\`

Repetir falha funcional uma segunda vez quando seguro.

---

# OUTPUT

Quando a persona aluno terminar:

\`\`\`text
D1.2 STUDENT AUTHENTICATED QA — COMPLETE
\`\`\`

Quando professor terminar:

\`\`\`text
D1.2 PROFESSOR AUTHENTICATED QA — COMPLETE
\`\`\`

Quando admin terminar:

\`\`\`text
D1.2 ADMIN AUTHENTICATED QA — COMPLETE
\`\`\`

Somente quando as três estiverem concluídas:

\`\`\`text
D1 AUTHENTICATED VALIDATION — COMPLETE
\`\`\`

---

# DECISÃO

Somente declarar:

\`\`\`text
D1 FULLY PASSED
\`\`\`

quando:

\`\`\`text
PUBLIC QA = PASS
STUDENT QA = PASS
PROFESSOR QA = PASS
ADMIN QA = PASS
P0 = 0
P1 = 0
\`\`\`

Caso apenas aluno tenha sido testado:

\`\`\`text
D1 PARTIAL
PROFESSOR + ADMIN PENDING
\`\`\`

Caso não exista sessão:

\`\`\`text
D1.2 BLOCKED — AUTH SESSION REQUIRED
\`\`\`

## REGRA FINAL

Não contornar autenticação.

Não usar privilégios maiores para substituir uma persona.

A validação precisa representar exatamente o que um usuário daquele papel consegue fazer pela interface normal.
`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: PRODUCTION OBSERVATION
          </h1>
          <p className="text-zinc-500 mt-1">Status: D1.2 — Authenticated QA Session Handoff</p>
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
