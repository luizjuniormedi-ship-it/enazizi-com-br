# Loop 3E — Migração Edge Functions P0/P1 para getClaims + Fallback

Data: 2026-05-09
Escopo estrito: 11 funções P0/P1 listadas em `loop-3d-security-hardening-report.md`.
**Sem alterar prompts, lógica pedagógica, modelos IA, payloads ou UI.**

---

## Resumo Executivo

| Item | Resultado |
|---|---|
| Funções migradas | **11/11** |
| Helper único criado | `supabase/functions/_shared/require-auth.ts` |
| 401 envelope canônico | ✅ `{success:false, error:"UNAUTHORIZED", message, requestId}` |
| OPTIONS preflight | ✅ 200 em todas |
| Sem auth → 401 (não consome IA) | ✅ 11/11 |
| Token inválido → 401 (não consome IA) | ✅ 11/11 |
| Runtime errors crus | ❌ Zero |
| Deploy | ✅ Todas 11 deployadas |

---

## Funções Migradas

### Grupo A — Sem auth alguma antes (4)
Auth injetada do zero, antes de qualquer chamada IA:
- `learning-optimizer` ✅
- `system-health-check` ✅
- `performance-predictor` ✅
- (já tinham `extractUserId` mas envelope 401 não-canônico) `feynman-trainer`, `motivational-coach`, `anamnesis-trainer`, `mentor-chat` ✅

### Grupo B — Legacy `auth.getUser()` substituído (4)
- `generate-study-plan` ✅
- `clinical-simulation` ✅ (era `getUser()` sem token!)
- `discursive-questions` ✅
- `dashboard-snapshot` ✅

---

## Padrão Adotado (`require-auth.ts`)

```ts
const auth = await requireAuth(req);
if (!auth.ok) return auth.response;
const userId = auth.userId;
```

Sequência interna:
1. `Authorization: Bearer <token>` obrigatório.
2. `supabase.auth.getClaims(token)` — verificação JWKS local, sem network.
3. **Fallback** `supabase.auth.getUser(token)` — network se claims falhar (compat HS256 legado).
4. Sem userId → retorna 401 JSON canônico com `requestId` UUID.

Garantias:
- Nenhuma chamada IA (`aiFetch`) acontece antes de `requireAuth.ok = true`.
- CORS preservado (mesmo header set já usado).
- OPTIONS continua respondendo 200 sem auth.

---

## Resultado dos Testes Live (curl contra produção)

Para cada uma das 11 funções:

| Cenário | Esperado | Observado |
|---|---|---|
| `OPTIONS /<fn>` | 200 + CORS | ✅ 200 |
| `POST /<fn>` sem Authorization | 401 JSON canônico | ✅ 401 + envelope correto |
| `POST /<fn>` com Bearer inválido | 401 JSON canônico | ✅ 401 + envelope correto |
| Crash / Runtime Error cru | nenhum | ✅ nenhum |

requestId presente e único em cada resposta — pronto para correlacionar logs.

---

## Risco Residual / Funções Restantes com `auth.getUser`

**43 ocorrências** em outras funções não-P0/P1 (escopo de loops futuros). Categorizadas:

### P2 — backlog próximo (lookups, planners, dashboards)
`benchmark-percentile`, `cockpit-data`, `medical-term-lookup`, `proficiency-planner`, `proficiency-progress-recalc`, `replan-overdue-tasks`, `schedule-review`, `practical-exam`, `calculate-approval-score`, `generate-daily-plan`.

### P3 — geradores IA secundários (já autenticam, mas via getUser legado)
`question-generator`, `generate-content-ai`, `generate-medical-mnemonic`, `generate-mnemonic`, `generate-image-questions`, `generate-mind-map`, `generate-map-questions`, `generate-map-flashcards`, `generate-adaptive-simulado`.

### P4 — pipelines / admin / service-role-only
`backfill-*`, `baseline-freeze-check`, `classify-question-hierarchy`, `cme-*`, `extract-exam-questions`, `ingest-questions`, `populate-questions`, `process-upload`, `professor-simulado`, `seed-proficiency-pilot`, `tutor-*`, `upgrade-image-questions`, `video-segmenter`, `search-rag-context`.

### P5 — webhook (mantém pattern atual, validação por signature)
`telegram-classroom`, `whatsapp-queue`.

**Importante:** estas usam `auth.getUser(token)` correto (não anônimas). O ganho de migrar é principalmente **performance** (menos network) e **uniformidade de envelope 401**, não segurança crítica.

---

## Linter & Regressões

- Linter Supabase: **189 issues, sem variação** (Loop 3D já fechou as security warnings; este loop só toca código de Edge Functions).
- Regressões funcionais: **nenhuma** — sem alteração de prompts, payloads, modelos IA ou shape de resposta de sucesso. O único shape novo é o 401 (que antes era heterogêneo entre funções).

---

## Confirmação de Escopo

- ❌ Nenhum prompt alterado
- ❌ Nenhuma lógica pedagógica alterada
- ❌ Nenhum modelo IA trocado
- ❌ Nenhum payload de request/response de sucesso modificado
- ❌ Nenhuma UI/frontend tocado
- ✅ Apenas auth no topo do handler + import do helper
- ✅ Nova helper file (`_shared/require-auth.ts`) + 11 functions com diff cirúrgico

---

## Próximo Loop Sugerido

**Loop 3F — Padronizar P2/P3 (10 funções de planner/dashboard + 9 geradores IA secundários)** para o mesmo padrão `requireAuth`. Diff esperado por função: 5–8 linhas. Sem mudança comportamental.
