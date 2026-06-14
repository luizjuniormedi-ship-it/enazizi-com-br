# Wave 9 — Quality Core Hardening Evidence

**Status executivo:** `QUALITY-CORE CONTRACT GATE READY — FREEZE SAFE`

## Funções cobertas

| Função | Existe | Auth | Contract test | Patch |
|---|---|---|---|---|
| `qa-agent` | ✅ | `requireAuth` (401) | ✅ `__tests__/contract.test.ts` (7 cenários) | Nenhum |
| `qa-autocorrect` | ✅ | Service-role interna (sem auth de usuário) | ✅ `__tests__/contract.test.ts` (6 cenários) | Nenhum |
| `quality-lock-validator` | ✅ | Service-role interna | ✅ `__tests__/contract.test.ts` (7 cenários) | Nenhum |

Funções não encontradas: nenhuma.

## Inspeção

- `qa-agent`: `OPTIONS` → 200 CORS; `requireAuth` valida JWT antes de qualquer lógica; `req.json().catch(() => ({}))` em uso; resposta de erro envelopada em `try/catch` raiz. Sem `.trim()`/`.toLowerCase()` em entradas não validadas no caminho principal.
- `qa-autocorrect`: `OPTIONS` → 200 CORS; body parse defensivo (`catch(() => ({}))`); defaults para `level`, `run_type`, `max_loops`; pipeline detecta e corrige erros conhecidos via service-role isolado. Não aceita questão inline arbitrária — opera sobre `questions_bank` por consulta segura.
- `quality-lock-validator`: `OPTIONS` → 200 CORS; valida `content_type`/`content_id`/`content_payload` antes de chamar AI; usa `errorResponse` (400) para faltantes; resposta IA é parseada em try/catch raiz.

## Bugs encontrados

Nenhum. Nenhum patch aplicado.

## Cenários cobertos

**qa-agent (7):** OPTIONS/CORS, 401 sem auth, JSON malformado, body vazio, payload mínimo válido, tipos inválidos (`level`/`run_type`), payload adversarial (`questions`/`alternatives`/`correct_index`/`topic`/`specialty`).

**qa-autocorrect (6):** OPTIONS/CORS, JSON malformado, body vazio, payload adversarial (`questionId` numérico, `question` string, `alternatives` null, `correct_index` 99, `mode` objeto), dry-run controlado, `level` string + `run_type` array.

**quality-lock-validator (7):** OPTIONS/CORS, JSON malformado, body vazio, `content_id` ausente, questão sem 4 alternativas, `correct_index` fora de faixa, `alternatives` não-array.

## Invariantes protegidos

- Nenhuma resposta vaza `TypeError`, `Cannot read`, `toLowerCase`, `trim`, ou campo `"stack"`.
- Nenhum 5xx descontrolado para payload inválido.
- Payload inválido nunca promove conteúdo nem altera `correct_index`.
- Contrato HTTP público preservado.
- Sem alteração de prompts, rubrica de qualidade, schema, RLS, frontend, banco de questões ou funções já travadas (Waves 1–8).

## Riscos remanescentes

- `qa-autocorrect` e `quality-lock-validator` são internas (service-role) — não há gate de autenticação de usuário. Aceito por contrato atual; nenhuma rota pública sem rate-limit foi adicionada nesta Wave.
- `qa-agent` linhas 532/546 retornam `(e as Error).message` — não vaza stack, mas pode conter texto livre. Sem leak observado nos cenários de contrato.

## Execução

Sem token (cobertura parcial):
```bash
deno test --allow-net --allow-env \
  supabase/functions/qa-agent/__tests__/contract.test.ts \
  supabase/functions/qa-autocorrect/__tests__/contract.test.ts \
  supabase/functions/quality-lock-validator/__tests__/contract.test.ts
```

Com token (cobertura completa):
```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/qa-agent/__tests__/contract.test.ts \
  supabase/functions/qa-autocorrect/__tests__/contract.test.ts \
  supabase/functions/quality-lock-validator/__tests__/contract.test.ts
```

## CI gate

- Workflow: `.github/workflows/quality-core-contract.yml`
- Nome do workflow: `quality-core Contract Gate`
- Status check: `Quality core contract regression`

## Confirmação de freeze

Nenhuma alteração em prompts, rubrica de qualidade, schema, RLS, frontend,
banco de questões, FSRS, Planner, Tutor, Event Bus, Error Bank ou em
funções travadas nas Waves 1–8. Nenhum `index.ts` produtivo alterado nesta Wave.

`QUALITY-CORE CONTRACT GATE READY — FREEZE SAFE`
