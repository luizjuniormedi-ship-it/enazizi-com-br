# generate-recovery-flashcard — Contract Tests (Wave 8)

Freeze-safe HTTP contract regression for the error → recovery flashcard pipeline.

## Run without token

```bash
deno test --allow-net --allow-env \
  supabase/functions/generate-recovery-flashcard/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, 401 anônimo, JSON malformado, body vazio.

## Run with token

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/generate-recovery-flashcard/__tests__/contract.test.ts
```

Adds: `errorId`/`questionId` ausentes (400), `errorId` non-string,
`topic` non-string, uuid desconhecido, campos adversariais.

## Invariants

- Nunca vaza stack / `TypeError` / `Cannot read`.
- `enterpriseEdgeHandler` retorna 500 genérico `INTERNAL_ERROR` (sem stack) — aceito.
- Local templates (SEPSE / IAM / IC) + AI pipeline intocados.
- Flashcard governance (`applyQualityGate`, `insertFlashcardsWithFsrs`) intocada.

`FREEZE SAFE`
