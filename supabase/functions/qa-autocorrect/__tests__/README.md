# qa-autocorrect Contract Tests (Wave 9)

Freeze-safe contract regression suite for the `qa-autocorrect` Edge Function.

## Run without token
```bash
deno test --allow-net --allow-env \
  supabase/functions/qa-autocorrect/__tests__/contract.test.ts
```

## Run with token
```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/qa-autocorrect/__tests__/contract.test.ts
```

Also honors `SUPABASE_CONTRACT_USER_JWT`. CI: `quality-core Contract Gate`.
