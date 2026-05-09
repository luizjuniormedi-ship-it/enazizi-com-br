# Loop QA-Agent Fix — Hardening pós-3F-B

## Padrão adotado
- **Dual-mode:** (1) chamada do frontend com JWT real de admin/professor; (2) chamada interna/cron com header `x-internal-secret` igual a `INTERNAL_EDGE_SECRET` (env opcional) — em ambos os casos exige Authorization Bearer com JWT real.
- `requireAuth(req)` (helper compartilhado de Loop 3E) valida o token.
- Após auth, valida em `user_roles` se o caller tem papel `admin`, `professor`, `coordinator` ou `institutional_admin`. Caso contrário → 403 JSON `{ success:false, error:"FORBIDDEN", requestId }`.
- `callFunction()` agora usa o JWT do caller via variável de módulo `CALLER_TOKEN`. Adiciona headers de telemetria `x-qa-agent-caller` e `x-qa-agent-user` para auditoria nos logs downstream.
- Removidas as referências a `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` no caminho de chamadas downstream.

## Checklist
- anon key removida do caminho de chamadas: **sim** (apenas `getAdmin()` continua usando service_role para escrever em `qa_test_runs` / `qa_test_results`, conforme já era).
- token real repassado a question-generator e demais geradores: **sim**.
- internal secret usado: **sim, opcional** (`INTERNAL_EDGE_SECRET`); ainda assim exige Authorization para preservar auth downstream.
- service_role usado como usuário: **não**.
- prompts/modelos/payloads alterados: **não**.

## Testes runtime (curl em produção)
| Cenário | Esperado | Resultado |
|---|---|---|
| POST sem Authorization | 401 JSON UNAUTHORIZED | ✅ `{"success":false,"error":"UNAUTHORIZED",...}` |
| POST com anon key (Bearer anon) | 401 JSON UNAUTHORIZED | ✅ `{"success":false,"error":"UNAUTHORIZED",...}` |
| POST com token aluno (sem admin/professor) | 403 FORBIDDEN | (validado por código — `user_roles` lookup) |
| POST com token admin/professor | inicia run, repassa Bearer ao question-generator | (caminho ativo, dependente de login real) |

`question-generator` continua bloqueando anon key (Loop 3F-B, intacto).

## Arquivos
- editado `supabase/functions/qa-agent/index.ts`

## Regressões detectadas
Nenhuma. UI / prompts / modelos / payloads não tocados. Próximo: Loop 3F-C (admin/cron/webhook).
