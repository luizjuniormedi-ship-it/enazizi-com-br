# Simulacao de usuario com Playwright

Esta suite percorre o ENAZIZI como uma pessoa usando o navegador, sem chamar a
API diretamente e sem criar dados permanentes.

## Executar

```bash
npm ci
npx playwright install chromium
npm run test:user
```

Somente visitante, sem credencial:

```bash
npm run test:user:public
```

Para acompanhar o Chrome visivelmente:

```bash
npm run test:user:headed
```

Sem URL configurada, o Playwright inicia o Vite localmente em
`http://127.0.0.1:4173`. Para testar uma implantacao existente:

```bash
PLAYWRIGHT_TEST_BASE_URL=https://seu-ambiente.example npm run test:user
```

## Credenciais do aluno

O fluxo publico sempre roda. O fluxo autenticado requer estas variaveis no CI
ou em `.env.e2e.local` (arquivo ignorado pelo Git):

```env
E2E_USER_EMAIL=usuario-de-teste@example.com
E2E_USER_PASSWORD=senha-do-usuario-de-teste
```

Tambem sao aceitos os nomes legados `E2E_ALUNO_EMAIL` e
`E2E_ALUNO_PASSWORD`. Nunca inclua senha real em commit.

No Windows, configure a conta sem colocar a senha no historico do PowerShell:

```powershell
.\scripts\configure-e2e-user.ps1
npm run test:user:auth
```

Para acompanhar somente o fluxo autenticado no navegador:

```powershell
npm run test:user:auth:headed
```

Use uma conta exclusiva de QA, sem permissao administrativa e sem dados reais.

## Evidencias

- Relatorio HTML: `playwright-report/user-simulation/`
- Screenshots e videos de falhas: `test-results/user-simulation/`
- Erros JavaScript, console e HTTP 5xx: anexo `browser-problems.json`

Traces ficam desativados porque podem persistir os valores dos campos de login.
