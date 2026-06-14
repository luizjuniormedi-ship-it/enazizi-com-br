# qa-agent Contract Tests (Wave 9)

Freeze-safe contract regression suite for the `qa-agent` Edge Function.

## Run without token (partial coverage)
```bash
deno test --allow-net --allow-env \
  supabase/functions/qa-agent/__tests__/contract.test.ts
```

## Run with token (full coverage)
```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/qa-agent/__tests__/contract.test.ts
```

Also honors `SUPABASE_CONTRACT_USER_JWT`. No DB writes. CI: `quality-core Contract Gate`.
