import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `# WAR ROOM — E2E PERSONA SECRETS ACTIVATION & AUTH SMOKE

## MISSÃO

Completar a ativação do Authenticated QA Harness configurando as credenciais E2E em secrets seguros e executar os primeiros smoke tests autenticados.

Estado atual:

\`\`\`text
QA HARNESS ....................... READY
HARDCODED CREDENTIALS ............ REMOVED
STORAGE STATE .................... IGNORED
D1.2 ............................. BLOCKED BY SECRETS
\`\`\`

---

# REGRA DE SEGURANÇA

NÃO escrever credenciais em:

\`\`\`text
source code
git
yaml
markdown
console
logs
database migrations
\`\`\`

Não imprimir valores dos secrets.

Nunca retornar senha, token, cookie ou JWT na resposta.

---

# SECRETS OBRIGATÓRIOS

Configurar no ambiente seguro:

\`\`\`text
E2E_STUDENT_EMAIL
E2E_STUDENT_PASSWORD

E2E_PROFESSOR_EMAIL
E2E_PROFESSOR_PASSWORD

E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
\`\`\`

---

# PERSONAS

Garantir que cada credencial corresponda a uma conta real e separada:

\`\`\`text
STUDENT
PROFESSOR
ADMIN
\`\`\`

Não reutilizar uma conta admin nas três personas.

---

# VALIDAÇÃO DE PAPÉIS

Student:

\`\`\`text
/dashboard ........ permitido
/professor ........ negado
/admin ............ negado
\`\`\`

Professor:

\`\`\`text
/professor ........ permitido
/admin ............ negado
\`\`\`

Admin:

\`\`\`text
/admin ............ permitido
\`\`\`

Se qualquer persona tiver privilégios maiores que o necessário:

\`\`\`text
E2E PERSONA MISCONFIGURED
\`\`\`

---

# TESTE 1 — STUDENT AUTH SMOKE

Executar via Playwright:

\`\`\`text
/login
↓
E2E_STUDENT_EMAIL
+
E2E_STUDENT_PASSWORD
↓
Entrar
↓
/dashboard
\`\`\`

Validar:

\`\`\`text
login success
dashboard loaded
session persisted
\`\`\`

Depois:

\`\`\`text
reload
\`\`\`

Esperado:

\`\`\`text
permanece autenticado
\`\`\`

Depois tentar acessar:

\`\`\`text
/admin
\`\`\`

Esperado:

\`\`\`text
access denied / redirect
\`\`\`

---

# TESTE 2 — PROFESSOR AUTH SMOKE

Executar:

\`\`\`text
/login
↓
professor credentials
↓
/professor
\`\`\`

Validar:

\`\`\`text
professor dashboard loaded
session persisted after reload
\`\`\`

Tentar:

\`\`\`text
/admin
\`\`\`

Esperado:

\`\`\`text
negado
\`\`\`

---

# TESTE 3 — ADMIN AUTH SMOKE

Executar:

\`\`\`text
/login
↓
admin credentials
↓
/admin
\`\`\`

Validar:

\`\`\`text
admin loaded
session persisted after reload
\`\`\`

---

# STORAGE STATE

Gerar:

\`\`\`text
playwright/.auth/student.json
playwright/.auth/professor.json
playwright/.auth/admin.json
\`\`\`

Confirmar:

\`\`\`text
git ignored = YES
committed = NO
\`\`\`

---

# NÃO EXECUTAR AINDA

Não rodar o D1.2 completo antes dos três Auth Smoke tests passarem.

Primeiro validar apenas:

\`\`\`text
login
session reuse
RBAC
\`\`\`

---

# RELATÓRIO OBRIGATÓRIO

Retornar:

\`\`\`text
WAR ROOM — E2E AUTH ACTIVATION

Secrets available ............... YES/NO

Student Login ................... PASS/FAIL
Student Session Reuse ........... PASS/FAIL
Student RBAC .................... PASS/FAIL

Professor Login ................. PASS/FAIL
Professor Session Reuse ......... PASS/FAIL
Professor RBAC .................. PASS/FAIL

Admin Login ..................... PASS/FAIL
Admin Session Reuse ............. PASS/FAIL

StorageState Generated .......... YES/NO
StorageState Git Ignored ........ YES/NO
Secrets Exposed ................. NO

D1.2 READY ...................... YES/NO
\`\`\`

---

# DECISÃO

Se todos passarem:

\`\`\`text
AUTHENTICATED QA HARNESS CERTIFIED
D1.2 AUTHENTICATED DOGFOOD READY
\`\`\`

Se algum falhar:

\`\`\`text
AUTH HARNESS NEEDS FIX
\`\`\`

e indicar apenas:

\`\`\`text
persona
stage
expected
observed
\`\`\`

sem expor segredos.

## REGRA FINAL

Não alterar segurança para fazer o teste passar.

O objetivo é validar autenticação real com contas reais, usando apenas secrets seguros e Playwright.`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: E2E PERSONA SECRETS ACTIVATION & AUTH SMOKE
          </h1>
          <p className="text-zinc-500 mt-1">Status: WAR ROOM — E2E PERSONA SECRETS ACTIVATION & AUTH SMOKE</p>
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
              <Cpu className="h-3 w-3" /> QA Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-zinc-400">PENDING SECRETS</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" /> Auth Harness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-red-500">BLOCKED</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Security Debt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-amber-500">AUDITED</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-zinc-500">E2E Personas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-500">3 DEFINED</div>
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
