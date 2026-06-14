# generate-daily-plan — Contract Tests (Wave 7)

Freeze-safe HTTP contract regression for the daily plan coordinator.

## Run without token (anonymous subset)

```bash
deno test --allow-net --allow-env \
  supabase/functions/generate-daily-plan/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, missing auth, malformed JSON, empty body.

## Run with token (full suite)

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/generate-daily-plan/__tests__/contract.test.ts
```

Adds: empty payload (defaults), invalid timezone, non-string timezone,
non-boolean `force`, idempotency contract.

## Invariants

- Never 5xx, never leaks `TypeError`/`Cannot read`/stack.
- Always returns controlled JSON (`success|planId|error|message|tasks|...`).
- No prompt / FSRS / priority formula touched.

`FREEZE SAFE`
