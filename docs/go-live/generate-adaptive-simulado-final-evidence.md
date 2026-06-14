# Generate Adaptive Simulado — Final Go-Live Evidence

## 1. Executive Status

| Item | Valor |
|---|---|
| Status final | `GO-LIVE READY — FREEZE SAFE` |
| Data de consolidação | 2026-06-14 |
| Função auditada | `supabase/functions/generate-adaptive-simulado` |
| Escopo da correção | Sanitização de `topics` e `count`; gate de regressão; trava de release |
| Classificação | Freeze-safe (Go-Live Structural Freeze) |

## 2. Bug Fix Summary

| # | Bug | Antes | Depois |
|---|---|---|---|
| 1 | `topics=[]` / `[null,"","   "]` | Crash em `.toLowerCase()` (`TypeError`) | Filtro de strings válidas; fallback `"Clínica Médica"` |
| 2 | `count` negativo / `0` / `NaN` / string / gigante | Retornava qty inválida (ex.: `-5`, `99999`) | `Math.max(1, Math.min(coerced > 0 ? coerced : 10, 100))` |

Patch aplicado em `index.ts` durante o hardening; nenhuma alteração adicional desde então.

## 3. Regression Coverage (21/21)

| # | Cenário | # | Cenário |
|---|---|---|---|
| 1 | Body vazio | 12 | Só subtopics |
| 2 | Cardio + ENARE | 13 | Dedup 7d preservado |
| 3 | `count` + `specialty` | 14 | Board REVALIDA |
| 4 | Aliases `selected*` | 15 | `count` negativo → 10 |
| 5 | Multi-topics | 16 | `count` string `"7"` |
| 6 | `count: 200` → 100 | 17 | `topic` singular |
| 7 | `count: 1` mínimo | 18 | 401 sem auth |
| 8 | `count: 0` → 10 | 19 | OPTIONS / CORS |
| 9 | Tópico inexistente | 20 | `count: 99999` → 100 |
| 10 | `mode: ai_generation` | 21 | `topics: [null,"","   "]` |
| 11 | `topics: []` no-crash | | |

Arquivo: `supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts`

## 4. Contract Invariants

- `questions` é sempre `Array`.
- `questions.length >= 0`.
- `questions.length <= 100`.
- Resposta nunca expõe stack trace.
- Resposta nunca contém `TypeError`.
- Resposta nunca leak de crash em `.toLowerCase`.
- `OPTIONS` retorna 200/204 com headers CORS.
- Request sem `Authorization` válido → 401.
- `mode: "ai_generation"` preservado.
- Banco insuficiente → resposta controlada (não 500 cru).

## 5. CI Gate

| Item | Valor |
|---|---|
| Workflow path | `.github/workflows/generate-adaptive-simulado-contract.yml` |
| Workflow name | `generate-adaptive-simulado Contract Gate` |
| Job id | `contract` |
| Status check obrigatório | `Contract regression (21 scenarios)` |
| Secret opcional | `SUPABASE_CONTRACT_USER_JWT` |

**Local sem token (MODE A — público):**
```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```

**Local com token (MODE B — 21/21):**
```bash
USER_JWT=<jwt-real> deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```

## 6. Release Protection

- PR template: `.github/pull_request_template.md` (checklist de freeze + gate).
- Doc do gate: `docs/go-live/generate-adaptive-simulado-release-gate.md`.
- Branch Protection (manual): Settings → Branches → rule `main` → Require status checks → selecionar **`Contract regression (21 scenarios)`**.

## 7. Freeze Integrity

Nenhuma alteração em:

- prompts
- FSRS
- memória pedagógica
- Bank Guard
- frontend
- schema
- RLS
- Tutor
- Planner
- Event Bus
- Error Bank

`index.ts` da função foi tocado **apenas** no patch original de sanitização (`topics` + `count`). Nenhuma alteração desde então.

## 8. Failure Protocol

Se o gate falhar em um PR:

1. **Não fazer merge.**
2. Ler o cenário que quebrou no log do Actions.
3. Reproduzir localmente:
   ```bash
   deno test --allow-net --allow-env --allow-read \
     supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
   ```
4. Aplicar patch mínimo que **restaure o contrato** (não relaxar o teste).
5. Rodar a suíte de novo até passar.
6. Atualizar esta evidência se o contrato público mudar de forma intencional e aprovada.

## 9. Final Acceptance

`GENERATE-ADAPTIVE-SIMULADO GO-LIVE EVIDENCE COMPLETE — FREEZE SAFE`
