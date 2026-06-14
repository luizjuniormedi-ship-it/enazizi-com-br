# generate-adaptive-simulado — Contract Regression Suite

Freeze-safe HTTP contract suite for the `generate-adaptive-simulado` Edge
Function. Validates the 21 real-world scenarios consolidated during the
hardening pass. Does **not** touch prompts, FSRS, pedagogical memory,
Bank Guard, frontend, schema or RLS.

## Run locally — without token (MODE A)

Validates public scenarios only (401 unauth, OPTIONS/CORS, structural
no-crash). Authenticated 200-path tests are skipped cleanly.

```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or
`VITE_SUPABASE_PUBLISHABLE_KEY`) in env / `.env`.

## Run locally — with token (MODE B)

Runs the full 21/21 battery.

```bash
USER_JWT=<real-user-jwt> deno test --allow-net --allow-env --allow-read \
  supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts
```

Equivalent env name supported in CI: `SUPABASE_CONTRACT_USER_JWT`.

## Always runs (no token required)

- 18. Unauthenticated request → 401
- 19. CORS OPTIONS → 200/204
- Structural assertion: no `TypeError` / `toLowerCase` crash leak

## Skipped without token

Scenarios 1–17, 20, 21 (require an authenticated user JWT to reach the
200-path logic).

## Configure in GitHub Actions

Add an optional repo secret:

- `SUPABASE_CONTRACT_USER_JWT` → long-lived JWT of a test user

The workflow `.github/workflows/generate-adaptive-simulado-contract.yml`
runs on every PR/push touching the function. Without the secret, MODE A
runs and gates regressions on public contract. With the secret, the full
battery runs.

## Status

`CI CONTRACT GATE READY — FREEZE SAFE`
