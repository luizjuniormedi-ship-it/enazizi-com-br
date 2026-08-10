import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, ShieldCheck, Cpu } from "lucide-react";

const ProductionObservationPage = () => {
  const content = `# WAR ROOM — AUTHENTICATED QA HARNESS RECOVERY

## MISSÃO

Eliminar o bloqueio técnico que impede o D1.1/D1.2 Authenticated Dogfood.

O problema confirmado é:

\`\`\`text
ENAZIZI Auth .................... OPERACIONAL
Public/Auth Guards .............. CERTIFICADOS
Lovable Browser Harness ......... signed_out
Authenticated Dogfood ........... BLOQUEADO
\`\`\`

O objetivo desta tarefa NÃO é alterar a autenticação do ENAZIZI.

O objetivo é criar um mecanismo seguro, reproduzível e isolado para executar testes E2E autenticados com Playwright usando usuários QA legítimos.

---

# REGRA CRÍTICA

NÃO criar:

\`\`\`text
auth bypass
backdoor
magic admin route
JWT hardcoded
service_role no frontend
RLS bypass
login automático em produção
credenciais no Git
\`\`\`

NÃO modificar o fluxo normal de login dos usuários.

---

# ACHADO DE SEGURANÇA EXISTENTE

Auditar imediatamente o arquivo existente:

\`\`\`text
create_audit_user.ts
\`\`\`

Existe histórico de infraestrutura de auditoria contendo credenciais estáticas.

Tratar isso como dívida de segurança.

## AÇÃO

Remover qualquer:

\`\`\`text
email QA hardcoded
password hardcoded
service_role dependency insegura
\`\`\`

do código versionado.

Não imprimir os valores encontrados em logs ou relatório.

Se qualquer credencial versionada puder ter sido utilizada anteriormente, registrar:

\`\`\`text
[QA_HARDCODED_CREDENTIAL_DETECTED]
\`\`\`

e recomendar rotação do segredo correspondente.

Não realizar rotação automática sem autorização.

---

# ARQUITETURA ALVO

Implementar:

\`\`\`text
QA Credentials
      ↓
Environment Secrets
      ↓
Playwright Login
      ↓
Supabase Auth normal
      ↓
Session Cookie / Local Storage
      ↓
Playwright storageState
      ↓
Authenticated Test
\`\`\`

O Playwright deve entrar pela aplicação da mesma forma que um usuário normal.

---

# PERSONAS

Criar suporte a três personas independentes:

\`\`\`text
student
professor
admin
\`\`\`

Variáveis esperadas:

\`\`\`text
E2E_STUDENT_EMAIL
E2E_STUDENT_PASSWORD

E2E_PROFESSOR_EMAIL
E2E_PROFESSOR_PASSWORD

E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
\`\`\`

Nunca incluir valores reais no código.

---

# REGRA DE USUÁRIOS QA

Antes de criar qualquer usuário, verificar se já existem contas QA apropriadas.

Se existirem:

\`\`\`text
REUTILIZAR
\`\`\`

Não criar duplicatas.

Se não existirem, preparar mecanismo administrativo controlado para provisioning exclusivamente de QA.

Não executar criação em produção sem necessidade.

---

# ISOLAMENTO

Todos os usuários QA devem ser identificáveis como:

\`\`\`text
environment = QA
purpose = E2E
\`\`\`

quando a estrutura atual permitir isso sem migration.

Não criar schema novo apenas para marcar QA.

Se não existir campo adequado:

\`\`\`text
documentar
\`\`\`

e usar naming convention.

---

# RBAC

Cada usuário deve possuir somente o papel necessário.

## Student

\`\`\`text
student/user
\`\`\`

Não:

\`\`\`text
professor
admin
\`\`\`

## Professor

\`\`\`text
professor
\`\`\`

Não receber admin automaticamente.

## Admin

\`\`\`text
admin
\`\`\`

---

# PROIBIDO

Não criar uma única conta:

\`\`\`text
admin + professor + student
\`\`\`

para substituir as três personas.

Isso impediria validação real de:

\`\`\`text
RLS
RBAC
route guards
permissions
\`\`\`

---

# PLAYWRIGHT AUTH SETUP

Criar estrutura semelhante a:

\`\`\`text
tests/e2e/auth/
    student.setup.ts
    professor.setup.ts
    admin.setup.ts
\`\`\`

ou adaptar a estrutura E2E existente do projeto.

Não duplicar infraestrutura se já houver equivalente.

---

# LOGIN

Cada setup deve:

\`\`\`text
1. abrir /login
2. preencher email
3. preencher senha
4. clicar Entrar
5. aguardar autenticação
6. confirmar rota autorizada
7. salvar storageState
\`\`\`

Exemplo conceitual:

\`\`\`text
student
→ login
→ /dashboard
→ student.json

professor
→ login
→ /professor
→ professor.json

admin
→ login
→ /admin
→ admin.json
\`\`\`

---

# STORAGE STATE

Armazenar somente em diretório temporário/ignorado:

\`\`\`text
playwright/.auth/
\`\`\`

Garantir \`.gitignore\`.

Nunca commitar:

\`\`\`text
cookies
access_token
refresh_token
storageState
\`\`\`

---

# PROJECTS PLAYWRIGHT

Configurar projetos separados:

\`\`\`text
setup-student
student

setup-professor
professor

setup-admin
admin
\`\`\`

Com dependências:

\`\`\`text
student
dependsOn setup-student

professor
dependsOn setup-professor

admin
dependsOn setup-admin
\`\`\`

---

# SESSION VALIDATION

Antes de executar testes, confirmar pela própria aplicação:

### Student

\`\`\`text
/dashboard = autorizado
/admin = negado
\`\`\`

### Professor

\`\`\`text
/professor = autorizado
/admin = negado
\`\`\`

### Admin

\`\`\`text
/admin = autorizado
\`\`\`

Não alterar permissões para fazer teste passar.

Se role estiver incorreta:

\`\`\`text
QA PERSONA MISCONFIGURED
\`\`\`

---

# TESTE RLS BÁSICO

Com Student:

confirmar que consegue acessar apenas os próprios dados.

Não executar tentativa ofensiva.

Apenas verificar comportamento normal das telas autenticadas.

---

# TESTE DE SESSION REUSE

Após gerar \`storageState\`:

\`\`\`text
fechar browser
↓
abrir novo context
↓
carregar storageState
↓
abrir dashboard
\`\`\`

Esperado:

\`\`\`text
authenticated = true
\`\`\`

Se redirecionar para \`/login\`:

\`\`\`text
AUTH HARNESS FAILED
\`\`\`

---

# SESSION EXPIRATION

Não implementar refresh customizado se Supabase já gerencia refresh.

O harness deve usar o comportamento normal da aplicação.

---

# CI

Integrar com GitHub Actions somente utilizando:

\`\`\`text
GitHub Secrets
\`\`\`

Nunca:

\`\`\`text
plaintext
.env commitado
password no YAML
JWT no YAML
\`\`\`

---

# LOCAL / LOVABLE

Se os secrets E2E não estiverem disponíveis no ambiente atual:

NÃO inventar credenciais.

Retornar:

\`\`\`text
QA HARNESS READY
E2E SECRETS REQUIRED
\`\`\`

com a lista apenas dos NOMES das variáveis necessárias.

---

# NÃO DEPENDER DE LOVABLE_BROWSER_AUTH_STATUS

Após implementação, o dogfood automatizado não deve depender de:

\`\`\`text
LOVABLE_BROWSER_AUTH_STATUS
\`\`\`

A autenticação deve ser criada pelo próprio setup Playwright através do login normal.

---

# PRIMEIRO TESTE

Depois que secrets legítimos estiverem disponíveis:

executar somente:

\`\`\`text
STUDENT AUTH SMOKE
\`\`\`

Fluxo:

\`\`\`text
/login
↓
credenciais E2E
↓
/dashboard
↓
reload
↓
continua autenticado
\`\`\`

Depois verificar:

\`\`\`text
/admin
\`\`\`

Esperado:

\`\`\`text
ACCESS DENIED / REDIRECT
\`\`\`

---

# SEGUNDO TESTE

Professor:

\`\`\`text
/login
↓
/professor
↓
reload
↓
continua autenticado
\`\`\`

Validar que não recebe admin indevidamente.

---

# TERCEIRO TESTE

Admin:

\`\`\`text
/login
↓
/admin
↓
reload
↓
continua autenticado
\`\`\`

---

# GATE

Somente considerar o Auth Harness aprovado quando:

\`\`\`text
Student login ............... PASS
Student session reuse ....... PASS
Student RBAC ................ PASS

Professor login ............. PASS
Professor session reuse ..... PASS
Professor RBAC .............. PASS

Admin login ................. PASS
Admin session reuse ......... PASS

Credentials in Git .......... 0
StorageState in Git ......... 0
Auth bypass ................. 0
\`\`\`

---

# DEPOIS DO GATE

Somente depois disso executar:

\`\`\`text
D1.2 AUTHENTICATED DOGFOOD
\`\`\`

com:

\`\`\`text
Student
Professor
Admin
\`\`\`

utilizando os respectivos Playwright projects.

---

# NÃO EXECUTAR AINDA

Não executar automaticamente toda a bateria:

\`\`\`text
Tutor
Simulados
FSRS
Recovery
Plantão
Professor Simulado
Admin Scientific Audit
\`\`\`

antes do Auth Harness passar.

Primeiro certificar autenticação.

Depois executar o D1.2 completo.

---

# RELATÓRIO OBRIGATÓRIO

Retornar:

\`\`\`text
WAR ROOM — AUTHENTICATED QA HARNESS

Existing QA infrastructure ....... FOUND/NOT FOUND
Hardcoded credential risk ........ FOUND/NOT FOUND
Credentials committed ............ YES/NO
StorageState ignored ............. YES/NO

Student Account .................. READY/PENDING
Student Login .................... PASS/FAIL/NOT RUN
Student Session Reuse ............ PASS/FAIL/NOT RUN
Student RBAC ..................... PASS/FAIL/NOT RUN

Professor Account ................ READY/PENDING
Professor Login .................. PASS/FAIL/NOT RUN
Professor Session Reuse .......... PASS/FAIL/NOT RUN
Professor RBAC ................... PASS/FAIL/NOT RUN

Admin Account .................... READY/PENDING
Admin Login ...................... PASS/FAIL/NOT RUN
Admin Session Reuse .............. PASS/FAIL/NOT RUN

LOVABLE_BROWSER_AUTH dependency .. REMOVED/STILL REQUIRED

D1.2 READY ....................... YES/NO
\`\`\`

---

# DECISÃO

Se autenticação das três personas funcionar:

\`\`\`text
AUTHENTICATED QA HARNESS CERTIFIED

D1.2 AUTHENTICATED DOGFOOD
READY TO EXECUTE
\`\`\`

Se faltar apenas secrets:

\`\`\`text
QA HARNESS READY
E2E SECRETS REQUIRED
\`\`\`

Se houver falha de login/RBAC:

\`\`\`text
AUTH HARNESS NEEDS FIX
\`\`\`

e informar exatamente:

\`\`\`text
ROOT CAUSE
AFFECTED PERSONA
EXPECTED
OBSERVED
\`\`\`

---

# REGRA FINAL

Não resolva a ausência de sessão diminuindo a segurança.

Resolva criando um harness de QA que autentique exatamente como um usuário real e que possa ser repetido automaticamente em:

\`\`\`text
Lovable
Local
CI
\`\`\`

sem credenciais hardcoded e sem depender de uma sessão manual do navegador.
`;

  return (
    <div className="p-8 bg-zinc-950 text-zinc-100 min-h-screen font-mono text-sm space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="text-red-500" />
            WAR ROOM: AUTHENTICATED QA HARNESS RECOVERY
          </h1>
          <p className="text-zinc-500 mt-1">Status: WAR ROOM — AUTHENTICATED QA HARNESS RECOVERY</p>
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
