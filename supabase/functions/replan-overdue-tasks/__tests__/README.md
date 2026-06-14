# replan-overdue-tasks — Contract Tests (Wave 7)

Freeze-safe HTTP contract regression for the overdue review rescheduler.

## Run without token

```bash
deno test --allow-net --allow-env \
  supabase/functions/replan-overdue-tasks/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, missing auth, malformed JSON, empty body.

## Run with token

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/replan-overdue-tasks/__tests__/contract.test.ts
```

Adds: authenticated empty body, repeat call (idempotent contract),
adversarial extra fields (`tasks: "oops"`, `date: 12345`).

## Invariants

- Never 5xx, never leaks stack.
- Priority bump formula and FSRS untouched.

`FREEZE SAFE`
