# ENAZIZI — Validation Suite

Suíte automatizada de testes para validação pré-go-live do ENAZIZI.

## Estrutura

```
tests/
├── config/
│   └── env.example       # Template de variáveis de ambiente
├── fixtures/
│   └── users.template.json  # Perfis de usuário para carga
├── load/
│   └── k6-load-test.js   # Teste de carga (59 VUs, 6 perfis)
├── e2e/
│   └── mission-control.spec.ts  # Testes E2E Playwright
├── reports/
│   └── generate-report.js      # Gerador de relatório consolidado
├── run-validation.sh      # Script runner completo
└── README.md
```

## Pré-requisitos

```bash
# k6 (load tests)
brew install k6         # macOS
# ou: https://k6.io/docs/get-started/installation/

# Playwright (E2E)
npx playwright install chromium
```

## Configuração

```bash
cp tests/config/env.example tests/config/.env
# Editar tests/config/.env com credenciais de teste
```

## Execução

### Tudo de uma vez
```bash
bash tests/run-validation.sh
```

### Apenas carga
```bash
k6 run tests/load/k6-load-test.js --summary-export=tests/reports/k6-summary.json
```

### Apenas E2E
```bash
npx playwright test tests/e2e/ --reporter=json > tests/reports/playwright-results.json
```

### Apenas relatório
```bash
node tests/reports/generate-report.js
```

## Critérios de Aprovação

| Critério | Threshold |
|----------|-----------|
| Error rate | < 3% |
| p95 latency | < 2500ms |
| p99 latency | < 5000ms |
| E2E fluxos críticos | 100% pass |
| UX continuidade | Sem tela vazia |

## Relatórios

Após execução, os relatórios ficam em `tests/reports/`:
- `test-report.md` — Relatório legível
- `test-report.json` — Dados estruturados
- `k6-summary.json` — Métricas k6 brutas
- `playwright-results.json` — Resultados Playwright

## Perfis de Carga (59 usuários)

| Perfil | VUs | Comportamento |
|--------|-----|---------------|
| Light | 20 | 1-2 loops, sai |
| Moderate | 15 | 3-5 loops + quick actions |
| Intense | 10 | 8+ loops + explain-deep |
| Abandon | 7 | Inicia e abandona |
| Error-prone | 5 | Erros repetidos + reinforcement |
| Quick Action | 2 | Todas as actions em sequência |
