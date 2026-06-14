# process-upload — Hardening Evidence (Wave 5)

## 1. Status executivo
`PROCESS-UPLOAD CONTRACT GATE READY — FREEZE SAFE`

## 2. Bugs encontrados
- `await req.json()` sem `catch` → JSON malformado gerava 500 com mensagem do parser.
- `uploadId` aceito sem validação de tipo/shape → IDs não-string podiam vazar para
  query Postgres e gerar erro 500 com texto interno.
- Catch top-level retornava `err.message` cru → potencial leak de detalhes internos.

## 3. Patches aplicados (mínimos, defensivos)
- Parse seguro: `req.json().catch(() => null)` + guard `typeof body === "object"`.
- Sanitização: `uploadId` exigido como string trimada + regex de shape `[0-9a-fA-F-]{8,64}`.
- `module` tipado defensivamente (string opcional).
- Respostas 400 controladas em vez de `throw new Error`.
- Catch top-level loga internamente e retorna `{ success:false, error:"Internal error" }`.

Não foram alterados: prompts, pipeline de extração PDF/DOCX/OCR, chamadas IA,
schema, RLS, frontend, Tutor, Planner, Bank Guard, FSRS, memória,
`generate-adaptive-simulado`, `question-generator`, `tutor-v3-premium`,
`generate-flashcards`.

## 4. Cenários testados
1. OPTIONS/CORS → 200/204 sem processamento.
2. Sem Authorization → 401 controlado.
3. JSON malformado → 400 sem stack.
4. Body vazio → 400 sem stack.
5. `uploadId` ausente → 400.
6. `uploadId` vazio → 400.
7. `uploadId` não-string (number) → 400, sem crash.
8. `uploadId` inválido (shape) → 400.
9. `uploadId` UUID inexistente → 404.
10. `module` não-string → controlado, sem crash.
11. `metadata` não-object → controlado, sem crash.
12. Nenhuma resposta vaza `TypeError`/`Cannot read`/`"stack"`.

## 5. Invariantes protegidos
- Contrato público preservado (`success`, `uploadId`, `message`, `error`).
- Auth obrigatória.
- Sem 5xx cru em payload inválido.
- Sem criação de registros órfãos em payload inválido (validação acontece antes
  de qualquer `insert`/`upsert`).
- Pipeline assíncrono (`EdgeRuntime.waitUntil`) só dispara após validações.

## 6. Riscos remanescentes
- Falhas reais de Storage/IA continuam sendo tratadas no background com
  `uploads.status = "error"` — comportamento mantido.
- OCR de imagem grande pode estourar timeout do gateway (fora de escopo Wave 5).

## 7. Freeze confirmation
- Prompts: intocados.
- FSRS / Memória / Bank Guard: intocados.
- Schema / RLS: intocados.
- Frontend: intocado.
- Funções já travadas: intocadas.

## 8. Status final
`PROCESS-UPLOAD CONTRACT GATE READY — FREEZE SAFE`
