# Fase 3A — Shadow Adaptive Layer (relatório de execução)

**Data:** 2026-04-27  
**Modo:** observacional, freeze respeitado  
**Status:** ✅ implementado em shadow, **flags OFF em produção**

---

## 1. Princípio aplicado

Camada única, silenciosa, opt-in via flag. Quando qualquer flag estiver `false`,
o helper retorna no-op imediato — zero latência, zero escrita, zero impacto.

```
shadow_adaptive_enabled  ← master switch
    ├── unified_events_enabled    → emite shadow_* em telemetry_events
    ├── shadow_decisions_enabled  → grava decisões/outcomes simulados
    └── shadow_scores_enabled     → grava scores cognitivos passivos
```

**Em produção todas estão OFF.** Só serão ligadas manualmente por admin
em ambiente beta.

---

## 2. Arquivos alterados (8)

| Arquivo | Mudança |
|---|---|
| `src/lib/shadowAdaptive.ts` (novo) | Helper único: `emitShadowEvent`, `logShadowDecision`, `logShadowOutcome`, `logShadowScores` |
| `src/hooks/useFeatureFlags.ts` | +4 flags shadow, defaults `false` |
| `src/hooks/useEnaflixUsage.ts` | `recordVisit` → `watch_started` |
| `src/hooks/useStudySession.ts` | `startSession` → `simulation_started`; `endSession` → `simulation_finished` + outcome |
| `src/hooks/useFsrs.ts` | `review` → `flashcard_review_completed` (NÃO altera fila FSRS) |
| `src/hooks/useGenerateMnemonic.ts` | `onSuccess` → `mnemonic_created` |
| `src/hooks/useCompleteTrajectoryAction.ts` | `onSuccess` → `task_completed` + outcome (NÃO recalcula planner) |
| `src/hooks/tutor/useStreamingResponse.ts` | início do stream → `tutor_session_started` |

**Migrations:**
- `system_flags`: insert das 4 chaves shadow (rollout_mode `admins_only`, `enabled=false`).

---

## 3. Tabelas usadas (zero novas)

| Tabela | Uso shadow |
|---|---|
| `telemetry_events` | eventos unificados (`shadow_<event>`, prefixo identificador, RLS já em vigor) |
| `assistant_decisions` | decisões/outcomes/scores (`source_module='shadow-adaptive-v1'`) |
| `system_flags` | 4 novas chaves |

Nenhuma tabela criada. Nenhuma RLS alterada. Nenhum schema novo.

---

## 4. Eventos implementados (1 por módulo, mínimo viável)

| Módulo | Evento(s) | Hook |
|---|---|---|
| ENAFLIX | `watch_started` | `useEnaflixUsage` |
| Tutor IA | `tutor_session_started` | `useStreamingResponse` |
| Simulado | `simulation_started`, `simulation_finished` + outcome | `useStudySession` |
| Flashcard / FSRS | `flashcard_review_completed` | `useFsrs` |
| Mnemônico v2 | `mnemonic_created` | `useGenerateMnemonic` |
| Planner | `task_completed` + outcome | `useCompleteTrajectoryAction` |

> Vocabulário expandido (todos os ~25 nomes do brief) já está tipado em
> `ShadowEventName`. Adicionar novos pontos de captura no futuro é trivial:
> basta importar o helper e chamar `emitShadowEvent(...)`. **Sem migration.**

---

## 5. Garantias de não-contaminação (checklist)

| Garantia | Como é cumprida |
|---|---|
| ❌ NÃO altera ranking real | helper nunca toca `study-next`, `studyEngine.ts`, `study-orchestrator` |
| ❌ NÃO recalcula planner | `useCompleteTrajectoryAction` apenas registra; sem invocar trajectory-engine |
| ❌ NÃO unifica FSRS | `useFsrs.review` mantém intacto; shadow é chamada DEPOIS do log oficial |
| ❌ NÃO ativa recovery automático | nenhuma rota de recuperação foi tocada |
| ❌ NÃO sobrescreve study-next | grep confirmou: `study-next` não importa shadowAdaptive |
| ❌ NÃO interfere na missão diária | `daily-plan` intocado |
| ❌ NÃO dispara reranking | sem chamadas para alert-orchestrator/intervention-engine |

Verificação:
```
$ rg -l shadowAdaptive supabase/functions/study-next supabase/functions/study-orchestrator src/lib/studyEngine.ts
(vazio)
```

---

## 6. Segurança e idempotência

- **RLS:** reusa `telemetry_events` e `assistant_decisions`, ambas com `user_id` obrigatório e isolamento por usuário já vigente.
- **Dedup:** chave por `(user, módulo, evento, tópico)` em janela de 5 min in-memory. Cleanup oportunista quando >200 chaves.
- **Cache de flags:** TTL 60s, single-flight (`flagPromise`), fallback `DISABLED` em qualquer erro.
- **Fire-and-forget:** todas as funções são `async void`, erros viram `console.warn` — nunca propagam para a UI.
- **Sem session_id duplicado:** cada evento gera UUID próprio (telemetria shadow é desacoplada da sessão visual).

---

## 7. Resultado do typecheck

```
$ npx tsc --noEmit -p tsconfig.app.json
(0 erros)
```

Erros de edge functions exibidos pelo runner (`@supabase/supabase-js@2.45.0`,
`TS18046` em `admin-actions`/`auto-assign-simulados`) **são pré-existentes** e
não relacionados à Fase 3A — nenhuma edge function foi tocada.

---

## 8. Confirmação final

- ✅ Nenhuma decisão adaptativa real foi ativada
- ✅ Nenhum motor pedagógico (study-next, planner, FSRS, recovery) foi alterado
- ✅ Flags OFF em produção — usuário não percebe nenhuma mudança
- ✅ Baseline observacional segue válida (zero eventos novos chegam a `telemetry_events` enquanto as flags estiverem desligadas)
- ✅ Infra pronta para ligar 1 flag por vez quando a baseline fechar

---

## 9. Como ativar (quando autorizado)

1. Ligar `shadow_adaptive_enabled = true` (admin).
2. Ligar a sub-flag desejada (`unified_events_enabled` para começar).
3. Observar `telemetry_events` filtrando `event_name LIKE 'shadow_%'` e
   `assistant_decisions` filtrando `source_module='shadow-adaptive-v1'`.
4. Comparar decisões shadow vs outcomes reais para calibrar o motor antes
   da Fase 3 completa.

**Nada é ativado automaticamente.**
