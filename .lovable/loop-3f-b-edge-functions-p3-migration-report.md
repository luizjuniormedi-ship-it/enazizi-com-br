# Loop 3F-B — Migração P3 Geradores IA Secundários para `requireAuth`

## Escopo
Migrar 9 Edge Functions geradoras de IA secundárias para `requireAuth`.
Sem alteração de prompt, modelo, payload, resposta de sucesso ou lógica pedagógica.

## Funções migradas (9/9)

| Função | Estado anterior | Estado atual |
|---|---|---|
| question-generator | **Auth opcional** (authUser apenas para telemetria — IA podia rodar sem JWT) | `requireAuth` no início + `authUser = { id: auth.userId }` |
| generate-content-ai | `auth.getUser(token)` após `req.json()` | `requireAuth` antes de body parse |
| generate-medical-mnemonic | helper `getUserIdFromRequest` (com `auth.getUser`) chamado depois do parse | `requireAuth` antes do parse e antes de qualquer agente IA |
| generate-mnemonic | helper `getUserIdFromRequest` chamado depois do parse | `requireAuth` no topo do try, antes de `aiKey` e parse |
| generate-image-questions | `auth.getUser(token)` (admin-only) | `requireAuth` substitui `auth.getUser`; check `user_roles` admin preservado |
| generate-mind-map | `auth.getUser()` via session client | `requireAuth` + cliente user-scoped preservado |
| generate-map-questions | `auth.getUser()` via session client | `requireAuth` + cliente user-scoped preservado |
| generate-map-flashcards | `auth.getUser()` via session client | `requireAuth` + cliente user-scoped preservado |
| generate-adaptive-simulado | `auth.getUser(token)` | `requireAuth` substitui |

### Destaque: question-generator
Antes desta loop, `question-generator` aceitava chamadas **sem JWT válido** — `authUser` era resolvido em best-effort apenas para registrar `userId` na telemetria; geração IA prosseguia mesmo se o auth header faltasse.
Após esta loop, **toda chamada a `question-generator` requer JWT válido antes de qualquer `aiFetch`** — fechando o vetor mais provável de queima de crédito IA por chamada anônima.

## Validação runtime (production endpoints)

| Cenário | Esperado | Observado | Resultado |
|---|---|---|---|
| `OPTIONS` | 200 (CORS) | 200 em 9/9 | ✅ |
| Sem `Authorization` | 401 JSON `UNAUTHORIZED` + `requestId` | 401 em 9/9 | ✅ |
| `Authorization: Bearer invalidtoken` | 401 JSON `UNAUTHORIZED` + `requestId` | 401 em 9/9 | ✅ |

**Total: 27/27 testes passando.**

Body padrão observado:
```json
{"success":false,"error":"UNAUTHORIZED","message":"Usuário não autenticado.","requestId":"<uuid>"}
```

## 401 antes de qualquer chamada IA
Confirmado para todas as 9: `requireAuth` é a primeira instrução dentro do `try` (ou imediatamente após validação de env vars). Nenhum `aiFetch`, `fetch` ao gateway Lovable AI ou OpenAI executa antes do retorno 401 quando o JWT está ausente/inválido.

## Funções restantes com `auth.getUser` ou `auth.getClaims`
**32 arquivos** ainda contêm referências legadas (P4/P5 — admin tools, processadores assíncronos, webhooks, hooks de email, ingestão batch). Próximo loop sugerido: **Loop 3F-C — Admin/Cron/Webhook hardening** (mais sensível: alguns precisam de `service_role` bypass, outros são chamados internamente entre Edge Functions).

## Regressões conhecidas / esperadas
- **`qa-agent`** chama `question-generator` usando `Authorization: Bearer <ANON_KEY>` (não um JWT de usuário). Após esta loop, essas chamadas retornarão 401 — **comportamento correto e esperado** (anon key não é um usuário). Migrar `qa-agent` para usar token de usuário admin é tarefa do próximo loop.
- Nenhuma regressão observada em fluxos de usuário real (frontend hooks `useAutoReplenish`, `Diagnostic`, `ExamSimulator`, `Simulados`, `QuestionGenerator` — todos enviam `session.access_token` válido).

## Não tocados (escopo estrito respeitado)
- ❌ Nenhum prompt de IA alterado
- ❌ Nenhum modelo alterado (`openai/gpt-5-mini`, `openai/gpt-5-mini`, `google/gemini-2.5-flash-image` etc.)
- ❌ Nenhum payload request/response alterado
- ❌ Nenhuma lógica pedagógica alterada (slot-based generation, validação Hard, banca profiles, FSRS, mnemonic agents)
- ❌ Nenhum arquivo `src/` modificado
- ❌ Nenhuma migration nova

## Status final
| Métrica | Valor |
|---|---|
| Funções migradas | **9/9** |
| Testes auth (OPTIONS / 401 sem auth / 401 token inválido) | **27/27 ✅** |
| 401 antes de qualquer IA call | ✅ Sim |
| Funções restantes com auth.getUser legado | 32 (P4/P5 admin/cron/webhook) |
| Regressões em fluxo de usuário real | Nenhuma |
| Regressões esperadas (qa-agent) | 1 — anon key bloqueado (correto) |
