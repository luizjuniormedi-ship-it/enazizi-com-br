# pedagogical-event-consumer — Contract Tests

Freeze-safe HTTP contract regression for the cognitive event consumer.

## Scope

Validates the **public HTTP contract** and defensive guards only. Does not
exercise pedagogical logic, FSRS, Planner, Error Bank, memory, or Event Bus
schema.

The function is a **blind orchestrator (v11)**: by design it always returns
`200 OK` (silent success / `[EDGE_SAFE_FAIL]`) so telemetry never crashes the
caller. Tests assert that no payload — valid, malformed, or adversarial —
produces a 5xx, a stack trace, or a `TypeError` leak.

## Run without token (anonymous-only subset)

```bash
deno test --allow-net --allow-env \
  supabase/functions/pedagogical-event-consumer/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, malformed JSON, empty body, missing/invalid `event`,
non-string `event_type`, null/non-object `metadata`, null/non-object `event`.

## Run with token (full suite)

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/pedagogical-event-consumer/__tests__/contract.test.ts
```

Adds: authenticated valid event (`blind_ok`) and duplicate event id idempotency
behavior.

## Invariants protected

- Never returns 5xx.
- Never leaks `TypeError` / `Cannot read` / stack traces.
- Always returns a controlled JSON shape (`success`/`ignored`/`blind_ok`/`error`).
- Anonymous calls are accepted as system events (no 401 crash).
- Missing `event`, missing `user_id`, and adversarial shapes are dropped silently.

## Freeze status

`FREEZE SAFE` — no production code, schema, RLS, prompts, FSRS, Planner,
Error Bank, Event Bus, or Tutor logic touched.
