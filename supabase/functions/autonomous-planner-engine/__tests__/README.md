# autonomous-planner-engine — Contract Tests (Wave 7)

Freeze-safe HTTP contract regression. Function uses `service_role` internally
and returns `200` with `{ success: false, error }` on any failure.

## Run without token

```bash
deno test --allow-net --allow-env \
  supabase/functions/autonomous-planner-engine/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, malformed JSON, empty body, missing `user_id`,
non-string `user_id`, empty `user_id`, unknown uuid.

## Run with token

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/autonomous-planner-engine/__tests__/contract.test.ts
```

Adds authenticated controlled call.

## Invariants

- Never 5xx, never leaks stack/TypeError.
- Pedagogical orchestration logic untouched (defaults, modes, thresholds).

`FREEZE SAFE`
