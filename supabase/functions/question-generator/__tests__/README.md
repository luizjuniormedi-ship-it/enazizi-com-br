# question-generator — Contract Regression Suite

Freeze-safe HTTP contract suite. Não toca prompts, FSRS, memória,
Bank Guard, frontend, schema ou RLS.

## Rodar sem token (MODE A — sempre roda)

```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/question-generator/__tests__/contract.test.ts
```
Valida OPTIONS/CORS, 401 sem auth e ausência de crash em payload vazio.

## Rodar com token (MODE B — bateria completa)

```bash
USER_JWT=<jwt-real> deno test --allow-net --allow-env --allow-read \
  supabase/functions/question-generator/__tests__/contract.test.ts
```
Equivalente em CI: `SUPABASE_CONTRACT_USER_JWT`.

## Cenários cobertos

- OPTIONS / CORS
- 401 sem auth
- body vazio (sem e com auth)
- `count` negativo / 0 / 99999 / string
- `topics=[]` / `[null,"","   "]`
- aliases `selectedTopics` / `selectedSubtopics`
- specialty / board / difficulty inválidos
- `mode: ai_generation`
- tipos errados em campos
- JSON inválido como body

## Invariantes protegidos

- Sem `TypeError`, `Cannot read`, `toLowerCase`, `"stack"` no body
- `questions.length` ∈ [0, 100]
- `requestedCount` ∈ [1, 100]
- `generatedCount` ∈ [0, 100]
- 5xx só permitido se `{success:false, error:"..."}` controlado

`question-generator CONTRACT SUITE READY — FREEZE SAFE`
