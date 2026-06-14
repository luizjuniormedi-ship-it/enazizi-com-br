# tutor-v3-premium — Contract Regression Suite

Freeze-safe HTTP contract suite for the `tutor-v3-premium` Edge Function.
Does **not** touch prompts, pedagogical logic, FSRS, memory, Bank Guard,
schema or RLS.

## Goals

Guarantee that the public HTTP contract of the Tutor V3 Premium never
crashes (`TypeError`, leaked stack traces) when receiving:

- empty / malformed payloads
- missing or invalid `message`, `intent`, `currentBlock`, `sessionId`
- non-array `history`
- unauthenticated requests

## How to run

### Mode A — no token (CI default, always-on)

Runs OPTIONS/CORS, 401 and structural no-crash checks only.

```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/tutor-v3-premium/__tests__/contract.test.ts
```

### Mode B — with user token (full battery)

```bash
USER_JWT=<jwt> \
deno test --allow-net --allow-env --allow-read \
  supabase/functions/tutor-v3-premium/__tests__/contract.test.ts
```

Accepted env vars: `USER_JWT`, `SUPABASE_CONTRACT_USER_JWT`.

## Scenarios

| # | Scenario | Token? |
|---|----------|--------|
| 1 | OPTIONS/CORS returns 200/204 | no |
| 2 | Unauthenticated request returns 401/403 | no |
| 3 | Healthcheck (no crash) | no |
| 4 | Empty body — no crash | no |
| 5 | Malformed JSON — controlled response | no |
| 6 | Minimal valid payload returns controlled envelope | yes |
| 7 | Empty `message` does not crash | yes |
| 8 | Non-string `message` does not crash | yes |
| 9 | Invalid `intent` — controlled fallback | yes |
| 10 | Invalid `currentBlock` — no crash | yes |
| 11 | Invalid `sessionId` — controlled error | yes |
| 12 | `history` non-array — no crash | yes |
| 13 | Adversarial payload never leaks `TypeError` / stack | yes |

## Invariants protected

- No raw 500 with stack trace
- No `TypeError` / `Cannot read` leaked to client
- Response either is a controlled error envelope OR a tutor-shaped payload
- `lessonComplete` (when present) is boolean
- `currentBlock` (when present) is string

## Status

`FREEZE-SAFE` — no production code changes required.
