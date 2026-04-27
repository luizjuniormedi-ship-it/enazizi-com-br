# Reset do Plano de Estudo — Relatório Final de Correção

## 1. Fontes que vazavam dados antigos após o reset

| Fonte | Componente UI | Fix aplicado |
|---|---|---|
| `study-next` → `revisoes` (status=pendente) | `CinematicMissionHero` ("Sua missão de hoje") | Filtro `created_at > last_study_plan_reset_at` |
| `study-next` → `error_bank` (dominado=false) | `CinematicMissionHero` (deriva mnemônico/visual) | Filtro `updated_at > last_study_plan_reset_at` |
| `chat_conversations` (agent_type=chatgpt-agent) | `TutorContinueCard` ("Retomar conversa") | Filtro `updated_at > last_study_plan_reset_at` |
| `user_mnemonic_links` | `AdaptiveMnemonicCard` (via `useDashboardMnemonic`) | Filtro `updated_at > last_study_plan_reset_at` |

## 2. Onde `last_study_plan_reset_at` foi salvo

- **Tabela:** `public.profiles`
- **Coluna:** `last_study_plan_reset_at TIMESTAMPTZ NULL`
- **Migration:** `supabase/migrations/20260427012406_*.sql`
- **Setado por:** `src/lib/resetUserStudyPlan.ts` no início do reset (`new Date().toISOString()`).
- **Lido por:**
  - Frontend → `useCoreData` (publicado em `coreData.profile.last_study_plan_reset_at`).
  - Edge `study-next` → query direta em `profiles` no início do handler.

## 3. Filtros aplicados (resumo técnico)

### Edge function `study-next` (`supabase/functions/study-next/index.ts`)
- Bloco novo no início do handler lendo `last_study_plan_reset_at` do profile.
- Query `revisoes`: `if (resetAt) q = q.gt("created_at", resetAt)`.
- Query `error_bank`: `if (resetAt) q = q.gt("updated_at", resetAt)`.
- **Não filtrado** (intencional): `fsrs_cards`, `medical_image_attempts`, `mnemonic_results/feedback` — são histórico pedagógico e o campo `due` evolui dinamicamente com o tempo. Apagá-los da missão atual quebraria o motor de retenção espaçada.
- `daily_plan_tasks`: já é apagado no reset, então não precisa de fence.

### Frontend
- `useCoreData`: já expõe `profile.last_study_plan_reset_at` (sem refetch adicional).
- `useDashboardMnemonic`: filtro em `user_mnemonic_links.updated_at`.
- `TutorContinueCard`: filtro em `chat_conversations.updated_at`.
- React Query keys passaram a incluir `resetAt` para invalidação automática.

## 4. Histórico preservado (zero perda)

Permanecem intactos e visíveis nas páginas próprias:
- `chat_conversations` + `chat_messages` (Tutor — `/dashboard/sessao-estudo` mostra todo o histórico).
- `mnemonic_results`, `user_mnemonic_links`, `mnemonic_feedback` (página de Mnemônicos).
- `revisoes` (status=pendente continua existindo no Banco de Revisões).
- `error_bank`, `fsrs_cards`, `practice_attempts`, `exam_sessions` (Proficiência / Banco de Erros).
- `module_sessions` (auditoria — apenas as `active` foram marcadas como `abandoned`).
- Gamificação, XP, streak, mapa de domínio, simulados realizados, anamneses.

## 5. Motores pedagógicos NÃO alterados

- ✅ `study-next` apenas ganhou um filtro defensivo em duas queries (revisoes/error_bank). Pesos, scoring e ordenação intactos.
- ✅ `study-orchestrator`, `study-engine`, FSRS engine, `planner`, `study-complete` → zero alteração.
- ✅ `shadow-adaptive-v1` → permanece desligado (Fase 3A inativa).
- ✅ Fórmulas de prioridade, CLS, RFS, scoring de visual/mnemônico → inalteradas.
- ✅ `assistant_decisions` continua sendo escrito normalmente (apenas reflete a nova lista filtrada).

## 6. Comportamento esperado pós-reset

1. `last_study_plan_reset_at` é setado em `profiles`.
2. `daily_plans` / `daily_plan_tasks` / `study_plans` apagados.
3. `module_sessions` ativos → `abandoned` (zera "Continuar de onde parou").
4. `dashboard_snapshots` marcado como stale.
5. localStorage (`enazizi:mission:*`, `enazizi-mission-state`, etc.) e sessionStorage (`enaflix:origin`, `enaflix:lastModule`) limpos.
6. `generate-daily-plan` é invocado.
7. React Query cache → `removeQueries` + `invalidateQueries`.
8. Próximo render do Dashboard:
   - "Sua missão de hoje" só usa revisões/erros posteriores ao reset.
   - "Retomar conversa" só aparece se houve conversa nova após o reset.
   - "Mnemônico recomendado" só aparece se houve link novo após o reset.

## 7. Arquivos alterados nesta fase

- `supabase/functions/study-next/index.ts` — leitura do reset_at + filtros em `revisoes` e `error_bank`.

(Os demais arquivos — `resetUserStudyPlan.ts`, `useCoreData.ts`, `useDashboardMnemonic.ts`, `TutorContinueCard.tsx`, migration `last_study_plan_reset_at` — já tinham sido modificados nas iterações anteriores.)

## 8. Resultado do typecheck

```
$ npx tsc --noEmit
(no output, exit 0)
```

✅ Frontend: 0 erros.
ℹ️ Erros de build em outras edge functions (admin-actions, ai-cache, etc.) são pré-existentes e não relacionados a esta mudança — `study-next` em si compila.

## 9. Próxima ação sugerida (opcional)

Após o usuário fazer um novo reset em produção:
- Verificar nos console logs (`[RESET-DEBUG]`) que `resetAt` chega aos componentes.
- Confirmar via Network tab que a chamada `study-next` retorna `recommendation` baseado apenas em itens pós-reset.
