# Loop 3F-A — Migração P2 Planner/Dashboard para `requireAuth`

## Escopo
Migrar 10 Edge Functions P2 para `requireAuth` (helper criado no Loop 3E).
Sem alteração de prompt, modelo, payload, resposta de sucesso ou lógica.

## Funções migradas (10/10)
| Função | Auth antes | Auth depois |
|---|---|---|
| benchmark-percentile | `auth.getUser()` (sessão via header) | `requireAuth(req)` |
| cockpit-data | `auth.getUser()` (sessão via header) | `requireAuth(req)` |
| medical-term-lookup | `auth.getUser()` (sessão via header) | `requireAuth(req)` |
| proficiency-planner | `admin.auth.getUser(token)` | `requireAuth(req)` |
| proficiency-progress-recalc | `admin.auth.getUser(token)` | `requireAuth(req)` (mantém `authHeader` para chamada interna ao planner) |
| replan-overdue-tasks | `getClaims` + fallback inline | `requireAuth(req)` (canonicaliza envelope 401) |
| schedule-review | `auth.getUser()` (sessão via header) | `requireAuth(req)` |
| practical-exam | `auth.getUser()` (sessão via header) | `requireAuth(req)` (mantém `supabase` user-scoped para writes RLS) |
| calculate-approval-score | `auth.getUser()` (sessão via header) | `requireAuth(req)` (mantém `userClient` user-scoped para writes RLS) |
| generate-daily-plan | `getClaims` + fallback (helper local `resolveUserId`) | `requireAuth(req)` (helper local removido) |

## Padrão aplicado
```ts
const auth = await requireAuth(req);
if (!auth.ok) return auth.response;
const userId = auth.userId; // ou: const user = { id: auth.userId };
```
- IA / writes / queries só executam após `auth.ok === true`.
- Variável `authHeader` reconstruída a partir de `auth.token` quando ainda usada para client user-scoped (RLS) ou fetch interno.

## Validação runtime (production endpoints)
30/30 testes passando — OPTIONS / sem auth / token inválido para cada função.

| Cenário | Esperado | Observado | Resultado |
|---|---|---|---|
| OPTIONS | 200 (CORS) | 200 em 10/10 | ✅ |
| Sem `Authorization` | 401 JSON `UNAUTHORIZED` + `requestId` | 401 em 10/10 | ✅ |
| `Authorization: Bearer invalidtoken` | 401 JSON `UNAUTHORIZED` + `requestId` | 401 em 10/10 | ✅ |

Body padrão observado:
```json
{"success":false,"error":"UNAUTHORIZED","message":"Usuário não autenticado.","requestId":"<uuid>"}
```

## Funções restantes com `auth.getUser` legado
Ainda há `auth.getUser` em funções P3/P4/P5 (geradores IA secundários, admin, fluxos auxiliares).
Próximo loop sugerido: **Loop 3F-B — P3 geradores IA secundários**.

## Não tocados (escopo estrito respeitado)
- Nenhum prompt de IA alterado.
- Nenhum modelo alterado (gpt-5-mini etc.).
- Nenhum payload de request/response alterado.
- Nenhuma lógica de negócio (planner, FSRS, score, percentile) alterada.
- Nenhum arquivo `src/` modificado.
- Nenhuma migration nova.

## Status
- Funções migradas: 10/10
- Testes auth (OPTIONS / 401 sem auth / 401 token inválido): 30/30 ✅
- 401 sem consumir IA: ✅ sim (validação anterior à `aiFetch`)
- Linter alterado: N/A (nenhuma policy/SQL tocada)
- Regressões detectadas: nenhuma (caminho de sucesso preserva mesmo `userId`/`user.id`)
