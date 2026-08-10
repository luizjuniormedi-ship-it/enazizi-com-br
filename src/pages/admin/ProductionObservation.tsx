import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `# WAR ROOM — QA PERSONA PROVISIONING FOR E2E AUTH

## MISSÃO

Provisionar três contas QA reais e separadas no Supabase Auth para viabilizar os testes E2E autenticados do ENAZIZI:

\`\`\`text
STUDENT
PROFESSOR
ADMIN
\`\`\`

Objetivo:

\`\`\`text
QA Users
↓
Supabase Auth
↓
RBAC correto
↓
Secrets seguros
↓
Playwright Auth Smoke
\`\`\`

---

# REGRAS ABSOLUTAS

NÃO:

\`\`\`text
usar uma única conta para as três personas
usar service_role no frontend
criar bypass de autenticação
alterar RLS para facilitar teste
hardcodar senha no código
commitar credenciais
expor tokens/JWT
usar usuários reais como QA
\`\`\`

As contas devem ser exclusivas de QA.

---

# 1. VERIFICAR SE JÁ EXISTEM CONTAS QA

Antes de criar qualquer usuário, pesquisar no Supabase Auth / profiles por contas QA existentes.

Preferir naming convention:

\`\`\`text
qa.student
qa.professor
qa.admin
\`\`\`

Se contas adequadas já existirem:

\`\`\`text
REUTILIZAR
\`\`\`

Não criar duplicatas.

---

# 2. CRIAR PERSONA STUDENT

Criar usuário QA exclusivo:

\`\`\`text
role = student/user
status = approved
\`\`\`

Garantir:

\`\`\`text
/admin = NEGADO
/professor = NEGADO
/dashboard = PERMITIDO
\`\`\`

Não atribuir:

\`\`\`text
admin
professor
\`\`\`

---

# 3. CRIAR PERSONA PROFESSOR

Criar usuário QA exclusivo:

\`\`\`text
role = professor
status = approved
\`\`\`

Garantir:

\`\`\`text
/professor = PERMITIDO
/admin = NEGADO
\`\`\`

Não atribuir admin.

---

# 4. CRIAR PERSONA ADMIN

Criar usuário QA exclusivo:

\`\`\`text
role = admin
status = approved
\`\`\`

Garantir:

\`\`\`text
/admin = PERMITIDO
\`\`\`

---

# 5. SENHAS

Gerar senhas fortes individualmente.

NÃO escrever as senhas em:

\`\`\`text
source code
markdown
commit
logs
console
migration
\`\`\`

NÃO retornar as senhas no relatório.

Se o ambiente não permitir armazenar secrets diretamente, parar após provisioning e informar:

\`\`\`text
PERSONAS CREATED
SECRETS MANUAL CONFIGURATION REQUIRED
\`\`\`

---

# 6. PERFIS / RBAC

Para cada conta, confirmar coerência entre:

\`\`\`text
auth.users
profiles
user_roles
\`\`\`

Nunca deixar estados contraditórios.

Exemplo:

\`\`\`text
profile.role = student
user_roles = [student]
\`\`\`

e não:

\`\`\`text
profile.role = student
user_roles = [admin]
\`\`\`

---

# 7. RLS / ROUTE GUARD VALIDATION

Após criar cada conta, validar pelo fluxo normal da aplicação:

## Student

\`\`\`text
/dashboard ........ PASS
/professor ........ BLOCKED
/admin ............ BLOCKED
\`\`\`

## Professor

\`\`\`text
/professor ........ PASS
/admin ............ BLOCKED
\`\`\`

## Admin

\`\`\`text
/admin ............ PASS
\`\`\`

Não ajustar permissões para fazer o teste passar.

---

# 8. NOMES DOS SECRETS

Preparar exatamente estes nomes:

\`\`\`text
E2E_STUDENT_EMAIL
E2E_STUDENT_PASSWORD

E2E_PROFESSOR_EMAIL
E2E_PROFESSOR_PASSWORD

E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
\`\`\`

---

# 9. CONFIGURAÇÃO DOS SECRETS

Se o Lovable permitir configuração segura de secrets pelo ambiente/tooling:

configurar os 6 secrets.

Nunca imprimir os valores.

Se não houver capacidade direta para isso:

retornar:

\`\`\`text
SECRETS CONFIGURATION REQUIRED IN LOVABLE UI
\`\`\`

e listar apenas os NOMES das variáveis.

---

# 10. NÃO ALTERAR O PRODUTO

Não modificar:

\`\`\`text
Login.tsx
AuthProvider
App.tsx
ProtectedRoute
RLS
Edge Functions
Dashboard
Professor
Admin
ProductionObservation
\`\`\`

Exceto se for descoberto um bug real independente do provisioning — nesse caso, apenas documentar, não corrigir nesta tarefa.

---

# 11. VALIDAR CONTAS VIA LOGIN NORMAL

Se os secrets estiverem disponíveis, executar smoke básico:

### Student

\`\`\`text
/login
→ student
→ /dashboard
\`\`\`

### Professor

\`\`\`text
/login
→ professor
→ /professor
\`\`\`

### Admin

\`\`\`text
/login
→ admin
→ /admin
\`\`\`

---

# 12. SECURITY CHECK

Confirmar:

\`\`\`text
Hardcoded credentials .......... 0
Service role frontend .......... 0
Shared persona account ......... 0
Admin privilege leakage ........ 0
Credentials logged ............. 0
\`\`\`

---

# RELATÓRIO OBRIGATÓRIO

Retornar:

\`\`\`text
WAR ROOM — QA PERSONA PROVISIONING

Student Account
Exists/Created ................. YES
Auth User ...................... YES
Profile ........................ YES
Role ........................... STUDENT
Approved ....................... YES
/admin access .................. BLOCKED
/professor access .............. BLOCKED

Professor Account
Exists/Created ................. YES
Auth User ...................... YES
Profile ........................ YES
Role ........................... PROFESSOR
Approved ....................... YES
/professor access .............. PASS
/admin access .................. BLOCKED

Admin Account
Exists/Created ................. YES
Auth User ...................... YES
Profile ........................ YES
Role ........................... ADMIN
Approved ....................... YES
/admin access .................. PASS

Security
Hardcoded credentials .......... NO
Shared account ................. NO
RLS modified ................... NO
Auth bypass .................... NO

Secrets
E2E_STUDENT_EMAIL .............. READY/PENDING
E2E_STUDENT_PASSWORD ........... READY/PENDING
E2E_PROFESSOR_EMAIL ............ READY/PENDING
E2E_PROFESSOR_PASSWORD ......... READY/PENDING
E2E_ADMIN_EMAIL ................ READY/PENDING
E2E_ADMIN_PASSWORD ............. READY/PENDING

D1.2 READY ..................... YES/NO
\`\`\`

---

# DECISÃO

Se contas + secrets estiverem prontos:

\`\`\`text
QA PERSONAS CERTIFIED
E2E AUTH SMOKE READY
\`\`\`

Se contas estiverem prontas mas secrets ainda não:

\`\`\`text
QA PERSONAS READY
SECRETS CONFIGURATION REQUIRED
\`\`\`

Se houver inconsistência de role/RBAC:

\`\`\`text
QA PERSONA PROVISIONING FAILED
\`\`\`

e informar somente:

\`\`\`text
persona
expected role
observed role
blocked route result
\`\`\`

sem expor credenciais.

## REGRA FINAL

Criar usuários QA separados e reais.

Não reduzir segurança para viabilizar o teste.

O harness deve validar exatamente o mesmo login, RBAC e RLS que um usuário normal do ENAZIZI utiliza.`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM — QA PERSONA PROVISIONING FOR E2E AUTH
          </h1>
          <p className="text-zinc-500 mt-1">Status: WAR ROOM — QA PERSONA PROVISIONING FOR E2E AUTH</p>
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
            <div className="text-lg font-bold text-zinc-400">PROVISIONING</div>
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
            <div className="text-lg font-bold text-blue-500">3 PENDING</div>
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
