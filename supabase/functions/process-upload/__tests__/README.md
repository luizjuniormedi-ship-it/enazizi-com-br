# process-upload — Contract Tests

Freeze-safe HTTP contract suite for the `process-upload` edge function.

## Objetivo
Garantir que `process-upload` preserve autenticação, CORS, validação defensiva e
ausência de stack trace, sem alterar prompts, FSRS, memória, schema ou RLS.

## Rodar sem token
```bash
deno test --allow-net --allow-env supabase/functions/process-upload/__tests__/contract.test.ts
```
Executa: OPTIONS/CORS, 401 sem auth, JSON malformado, body vazio.

## Rodar com token
```bash
USER_JWT="<jwt do usuário>" \
  deno test --allow-net --allow-env supabase/functions/process-upload/__tests__/contract.test.ts
```
Adiciona: uploadId ausente/vazio/não-string/inválido, uploadId desconhecido (404),
`module` inválido, `metadata` não-object.

Aceita também `SUPABASE_CONTRACT_USER_JWT`.

## Invariantes protegidos
- 401 sem `Authorization`.
- Nenhum `TypeError` / `Cannot read` / stack trace nas respostas.
- Body inválido ⇒ 400 controlado (nunca 500 cru).
- `uploadId` inexistente ⇒ 404.
- Shape: `success | error | message | uploadId | status | result`.

## Status
`PROCESS-UPLOAD CONTRACT GATE READY — FREEZE SAFE`
