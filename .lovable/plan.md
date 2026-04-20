

# 🧭 Plano — Alert Orchestrator (governança central de avisos)

Implementar uma **fonte única de verdade** que decide quais avisos do Dashboard renderizam, com qual prioridade, em qual camada e com deduplicação real. Sem reescrever UI: o orchestrator atua como **camada de decisão** que envolve os componentes existentes.

---

## 1. O que será criado

**`src/types/alertOrchestrator.ts`**
Tipos puros (separados do hook para evitar import cíclico):
- `AlertPriority` = `"critical" | "important" | "contextual" | "informational"`
- `AlertLayer` = `"structural" | "contextual" | "ephemeral" | "deep"`
- `AlertSource` = string semântica (ex: `"exam-date"`, `"approval-risk"`, `"approval-trend"`, `"coverage-risk"`, `"recovery"`, `"inactivity"`, `"fsrs-backlog"`, `"min-mission"`)
- `AlertOrchestratorItem` (conforme spec do usuário) + `suppressedBy?: string` para auditoria

**`src/lib/alertRules.ts`**
Função pura `buildCandidateAlerts(input)` que recebe um snapshot consolidado (approval, exam_date, recovery, fsrs due, impact) e devolve `AlertOrchestratorItem[]` brutos. Toda lógica de "quando aparecer" mora aqui (testável sem React).

**`src/hooks/useAlertOrchestrator.ts`**
Hook React que:
1. Consome `useApprovalPrediction`, `useCoreData`, `useStudyEngine` (para `recoveryMode`/`heavyRecovery`), `useStudyEngineImpact`, `useFsrsDueCount`.
2. Chama `buildCandidateAlerts`.
3. Aplica **dedupe** (por `dedupeKey`, mantém maior prioridade; em empate, mantém o de layer estrutural).
4. Aplica **caps por camada** (structural ≤ 2, contextual ≤ 2).
5. Aplica **regras de supressão cruzada** (deep não abre se houver critical estrutural; min-mission cai para contextual se já houver critical estrutural).
6. Devolve `{ structuralAlerts, contextualAlerts, ephemeralAlerts, deepAlerts, allAlerts, getDecision(source) }`.
   - `getDecision(source)` retorna `{ visible, priority, layer, suppressedBy }` — usado pelos componentes para decidir se renderizam.

**`src/components/admin/AlertOrchestratorDebug.tsx`**
Tabela read-only listando `source · priority · layer · visible · dedupeKey · suppressedBy`. Adicionada como nova seção em `src/pages/admin/ValidationDashboard.tsx` (não em rota nova; não exposto ao aluno).

---

## 2. O que será editado (modo não-destrutivo)

Cada componente alvo recebe **um único early-return** baseado em `useAlertOrchestrator().getDecision(...)`. UI permanece idêntica.

| Componente | Source | Mudança |
|---|---|---|
| `ExamDateRequiredBanner` | `exam-date` | Se `decision.visible === false`, retorna `null`. Demais condições atuais permanecem (snooze local etc.) |
| `RecoveryModeBanner` | `recovery` | Idem |
| `RiskAlertsCard` | `approval-risk` / `approval-trend` / `coverage-risk` / `fsrs-backlog` / `inactivity` | Em vez de listar manualmente, mapeia os `structuralAlerts` cuja `source` pertence a esse conjunto. Mantém visual, copy e CTAs atuais. Cap continua 3. |
| `MinimumDailyMissionCard` | `min-mission` | Se `decision.visible === false`, `null`. Se rebaixado a `contextual`, renderiza normal (já é card contextual hoje). |

**Sem mudanças em `GuidedFlowLayer.tsx`** — ele continua chamando os 4 componentes; a orquestração acontece dentro de cada um.

**Sem mudanças no `Dashboard.tsx`** além de continuar renderizando `RecoveryModeBanner` e `GuidedFlowLayer`.

**Sem alterar backend, sem migrações, sem novas tabelas.**

---

## 3. Regras de prioridade aplicadas

| Regra | Source | Priority | Layer |
|---|---|---|---|
| `exam_date` ausente (sem snooze) | `exam-date` | critical | structural |
| `approval.riskLevel === "high"` | `approval-risk` | critical | structural |
| `recoveryMode` ativo (heavy) | `recovery` | critical | structural |
| `recoveryMode` ativo (leve) | `recovery` | important | structural |
| `approval.trend === "down"` (delta ≤ -3) | `approval-trend` | important | structural |
| `riskLevel === "medium"` && coverage < 50 | `coverage-risk` | important | structural |
| FSRS due > 50 | `fsrs-backlog` | important | structural |
| `questions7d === 0` | `inactivity` | important | structural |
| FSRS due 20–50 | `fsrs-backlog` | contextual | contextual |
| Missão mínima (inativo, sem critical) | `min-mission` | contextual | contextual |
| Achievement / streak | `achievement` | informational | ephemeral |

---

## 4. Regras de dedupe / supressão

- **Dedupe por `dedupeKey`**: quando o `RiskAlertsCard` produz "sem exam_date" e o `ExamDateRequiredBanner` também, ambos compartilham `dedupeKey: "exam-date-missing"`. O orchestrator mantém **só o estrutural** (`ExamDateRequiredBanner`). O item correspondente dentro do `RiskAlertsCard` é marcado `visible: false` (`suppressedBy: "exam-date"`).
- **Inatividade vs missão mínima**: se houver alerta `critical` estrutural visível, `min-mission` é rebaixado de structural para contextual. Sem critical, sobe para structural.
- **Cap structural ≤ 2**: ordenação por prioridade (critical > important) + recência. Excedentes viram contextual quando aplicável; o resto fica `visible: false` com `suppressedBy: "structural-cap"`.
- **Deep layer**: `getDecision("onboarding-popup")` retorna `visible: false` se houver qualquer critical estrutural ativo.

---

## 5. Integração com Approval / FSRS / Exam Date / Inatividade

- **Approval**: lê direto do `useApprovalPrediction()` (já existente). Não recalcula. Usa `riskLevel`, `trend`, `delta`, `score`.
- **FSRS**: usa `useFsrsDueCount().totalDue` (já existente). Sem nova query.
- **Exam date**: lê de `useCoreData().profile.exam_date` + checa snooze local (`exam_date_banner_snoozed_until`) para casar com o banner atual.
- **Inatividade**: `useStudyEngineImpact().questions7d`.
- **Recovery**: `useStudyEngine().adaptive.recoveryMode` + `heavyRecovery` (igual ao banner atual).

---

## 6. Toasts (parte 10)

Esta sprint **não migra** os sistemas de toast. Apenas:
- Documenta no JSDoc do hook que toasts ficam na camada `ephemeral`.
- Expõe `getDecision("onboarding-popup")` e `getDecision("achievement")` para que futuras integrações usem o orchestrator antes de disparar.
- `useRevisionNotifier` e `Toaster`/`Sonner` permanecem intactos (zero regressão).

---

## 7. Validação final

- `npx tsc --noEmit` deve terminar com **0 erros**.
- Smoke test manual: Dashboard continua renderizando os mesmos 4 componentes; com `exam_date` faltando, `RiskAlertsCard` não duplica a linha "data da prova".
- Debug em `/admin/validation` mostra a árvore de decisão do orchestrator para o usuário admin.

---

## 8. Entrega

**Criados (4)**: `src/types/alertOrchestrator.ts`, `src/lib/alertRules.ts`, `src/hooks/useAlertOrchestrator.ts`, `src/components/admin/AlertOrchestratorDebug.tsx`.

**Editados (5)**: `ExamDateRequiredBanner.tsx`, `RecoveryModeBanner.tsx`, `RiskAlertsCard.tsx`, `MinimumDailyMissionCard.tsx`, `pages/admin/ValidationDashboard.tsx` (anexar painel de debug).

**Não editados**: `Dashboard.tsx`, `GuidedFlowLayer.tsx`, hooks de toast, Approval/Study Engine, backend.

