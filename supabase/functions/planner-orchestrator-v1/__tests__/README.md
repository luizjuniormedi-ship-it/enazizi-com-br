# planner-orchestrator-v1 — Contract Tests (Wave 7)

Freeze-safe HTTP contract regression for the central executor that
materializes proposals into `daily_plan_tasks`.

## Run without token

```bash
deno test --allow-net --allow-env \
  supabase/functions/planner-orchestrator-v1/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, wrong HTTP method, missing auth (401),
malformed JSON, empty body.

## Run with token

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/planner-orchestrator-v1/__tests__/contract.test.ts
```

Adds: empty payload (400), partial payload, invalid `actionType`, null action.

## Invariants

- Never 5xx, never leaks stack.
- Admission rules (dedupe, cooldown, daily cap, content_lock) untouched.
- Never writes `daily_plan_tasks` from invalid payloads.

`FREEZE SAFE`
