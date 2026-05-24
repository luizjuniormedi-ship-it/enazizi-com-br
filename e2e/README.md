# ENAZIZI E2E Tests

## Setup

```bash
npm install -D @playwright/test
npx playwright install
```

## Variáveis de Ambiente

Crie um arquivo `.env.e2e` na raiz:

```env
E2E_BASE_URL=http://localhost:8080
E2E_ALUNO_EMAIL=aluno@test.com
E2E_ALUNO_PASSWORD=senha123
E2E_PROFESSOR_EMAIL=professor@test.com
E2E_PROFESSOR_PASSWORD=senha123
E2E_ADMIN_EMAIL=admin@test.com
E2E_ADMIN_PASSWORD=senha123
VITE_SUPABASE_URL=https://qszsyskumcmuknumwxtk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Executar

```bash
# Todos os testes
npx playwright test --config=e2e/playwright.config.ts

# Apenas auth
npx playwright test e2e/01-auth.spec.ts

# Apenas segurança/RLS
npx playwright test e2e/07-rls-security.spec.ts

# Apenas mobile
npx playwright test e2e/11-mobile.spec.ts

# Com UI (debug)
npx playwright test --ui --config=e2e/playwright.config.ts

# Gerar relatório HTML
npx playwright show-report
```

## Estrutura

| Arquivo | Cobertura |
|---------|-----------|
| 01-auth | Login, logout, registro, permissões |
| 02-dashboard-aluno | Todas as páginas do aluno |
| 03-tutor-ia | Sessão de estudo, prompt injection |
| 04-simulados | Criar, responder, finalizar |
| 05-professor | Painel professor, turmas, questões |
| 06-admin | Painel admin, tabs |
| 07-rls-security | RLS, tokens, isolamento de dados |
| 08-flashcards-erros | FSRS, banco de erros |
| 09-upload-planner | Upload PDF, planner |
| 10-all-routes-smoke | Todas as rotas sem tela branca |
| 11-mobile | Responsividade mobile |
| 12-performance | Tempo de carga, bundle size |

## Notas

- Os testes de RLS (07) testam diretamente a API Supabase, não precisam do app rodando
- Os testes de performance (12) podem falhar em máquinas lentas — ajuste os thresholds
- Para rodar em CI, configure as variáveis de ambiente no pipeline
