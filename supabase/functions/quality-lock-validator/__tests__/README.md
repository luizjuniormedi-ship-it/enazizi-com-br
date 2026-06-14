# quality-lock-validator Contract Tests (Wave 9)

Freeze-safe contract regression suite for the `quality-lock-validator` Edge Function.

## Run without token
```bash
deno test --allow-net --allow-env \
  supabase/functions/quality-lock-validator/__tests__/contract.test.ts
```

## Run with token (optional)
```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/quality-lock-validator/__tests__/contract.test.ts
```

This function uses the service-role client internally and does not require user
auth; auth-gated cases are skipped by default. CI: `quality-core Contract Gate`.
