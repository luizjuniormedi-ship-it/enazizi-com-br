# Clinical Simulation Module — Wave 1 (Freeze v25 Compatible)

## Escopo (cirúrgico)

Esta wave estabelece a **fundação arquitetural** do módulo plantão clínico
sem alterar runtime, UX clínica ou regras pedagógicas (FSRS, Planner, Tutor,
TRI, simulados, scoring, completeStudyAction, Error Bank — tudo preservado).

## Estrutura

```
src/modules/clinical-simulation/
├── hooks/        useClinicalSimulation()           — orquestrador (em construção incremental)
├── state/        simulationReducer + simulationRuntime — state machine explícita + timers
├── telemetry/    clinicalTelemetry                  — fire-and-forget, non-blocking
├── contracts/    clinicalContracts                  — tipos do contrato edge→frontend
├── components/   (vazio — UI permanece em src/components/clinical-simulation)
└── utils/        audioRuntime                       — singleton de áudio
```

## Rollout (incremental, semanas entre cada passo)

1. ✅ Wave 1.0 — Fundação (este commit): módulos criados, audioRuntime e
   telemetry plugados na página; reducer/contratos prontos mas **não wired**
   ainda. Zero impacto comportamental.
2. ⏳ Wave 1.1 — Migrar `playSound` interno para `audioRuntime` em todos os
   call sites (5 lugares). Smoke test de áudio.
3. ⏳ Wave 1.2 — Plugar `clinicalTelemetry.*` nos eventos canônicos
   (started/restored/abandoned/completed/hint_used/etc).
4. ⏳ Wave 1.3 — Edge function `clinical-simulation` retorna campos do
   `EdgeResponseContract` (response_type, patient_status, score_delta,
   deterioration_level, abcde_detected, clinical_tags). Frontend continua
   tolerante ao formato antigo via fallback.
5. ⏳ Wave 1.4 — Remover heurísticas textuais (`includes("mg/dl")`, etc) e
   passar a consumir SOMENTE `EdgeResponseContract`.
6. ⏳ Wave 1.5 — Centralizar timers em `simulationRuntime` (countdown +
   inactivity + deterioration).
7. ⏳ Wave 1.6 — Plugar `useClinicalSimulation()` e reduzir
   `ClinicalSimulation.tsx` para <300 linhas (orquestrador de renderização).

## Proibições absolutas (toda a Wave)

- ❌ Tocar em FSRS / Planner / Tutor / TRI / simulados / scoring.
- ❌ Reescrever `useSessionPersistence`, `completeStudyAction`, Error Bank.
- ❌ Criar `adapters/`, `services/`, `orchestration/`, plugin systems.
- ❌ XState, CQRS, event bus, websocket, microservices.
- ❌ Integrar ontology, IA orchestration, novos engines.
- ❌ Alterar UX clínica visível ao aluno.

## Critério de sucesso final (pós-Wave 1.6)

- `ClinicalSimulation.tsx` < 300 linhas
- Estado centralizado em reducer
- Transições de fase explícitas
- Zero `includes()` para classificar resposta clínica
- Timers consistentes (sem intervalo duplicado)
- Telemetria estruturada funcional
- Persistence/restore íntegros
- Zero regressão UX / pedagógica
