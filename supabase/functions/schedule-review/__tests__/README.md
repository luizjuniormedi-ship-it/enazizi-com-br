# schedule-review — Contract Tests (Wave 8)

⚠️ Function is marked **DEPRECATED** (orphan — no frontend/edge function calls it).
Hardening preserves the current public contract.

## Run without token

```bash
deno test --allow-net --allow-env \
  supabase/functions/schedule-review/__tests__/contract.test.ts
```

Covers: OPTIONS/CORS, 401 anônimo, JSON malformado, body vazio.

## Run with token

```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/schedule-review/__tests__/contract.test.ts
```

Adds: campos obrigatórios ausentes, `tema_id` non-string, `was_successful: null`,
uuid desconhecido, `accuracy` non-number.

## Invariants

- Nunca vaza stack / `TypeError` / `Cannot read`.
- Controlled 500 com `{ error: message }` é aceito (contrato atual).
- Algoritmo SR (D1→D90) intocado.

`FREEZE SAFE`
