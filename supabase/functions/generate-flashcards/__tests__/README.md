# generate-flashcards — Contract Regression Suite

Freeze-safe HTTP contract suite for the `generate-flashcards` Edge Function.
Does **not** touch prompts, FSRS, memory, schema, RLS or frontend.

## Goals

Guarantee that the public HTTP contract never crashes
(`TypeError`, leaked stack traces) when receiving:

- empty / malformed payloads
- invalid `topic`, `quantity`, `uploadId`, `discipline`
- adversarial types
- unauthenticated requests

## How to run

### Mode A — no token (CI default, always-on)

```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-flashcards/__tests__/contract.test.ts
```

### Mode B — with user token (full battery)

```bash
USER_JWT=<jwt> \
deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-flashcards/__tests__/contract.test.ts
```

Accepted env vars: `USER_JWT`, `SUPABASE_CONTRACT_USER_JWT`.

## Scenarios

| # | Scenario | Token? |
|---|----------|--------|
| 1 | OPTIONS/CORS | no |
| 2 | Unauthenticated → 401/403 | no |
| 3 | Empty body | no |
| 4 | Malformed JSON | no |
| 5 | Minimal valid payload | yes |
| 6 | Empty topic | yes |
| 7 | Non-string topic | yes |
| 8 | quantity=0 | yes |
| 9 | Negative quantity | yes |
| 10 | Huge quantity (clamp) | yes |
| 11 | Numeric-string quantity | yes |
| 12 | Invalid uploadId | yes |
| 13 | Adversarial payload | yes |

## Invariants protected

- No raw 500 with stack trace
- No `TypeError` / `Cannot read` / `.trim is not` / `.toLowerCase is not` leaks
- Response is always controlled (envelope or error)
- Flashcard arrays, when returned, respect `front/back` (or equivalent)
- Server-side `clampQuantity` upper bound respected (≤ `FLASHCARD_MAX_QUANTITY`)

## Status

`FREEZE-SAFE` — no production code changes required.
