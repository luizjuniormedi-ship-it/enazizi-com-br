# Sprint 1 — Auditoria de Código Morto (somente diagnóstico)

**Data:** 2026-04-23
**Escopo:** rotas órfãs + componentes não importados
**Modo:** somente leitura — nenhum arquivo foi removido nesta sprint

---

## 1. Resumo executivo

| Categoria                                | Quantidade | Tamanho aprox. |
| ---------------------------------------- | ---------: | -------------: |
| Páginas órfãs (sem nenhum import)        |          3 |          ~12 K |
| Componentes `dashboard/` não importados  |         61 |         ~390 K |
| **Total de superfície morta detectada**  |     **64** |       **~402 K** |

> Nada será deletado sem aprovação. Este relatório existe para você decidir o que sai e o que fica.

---

## 2. Páginas órfãs (3)

Nenhuma referência em `src/`, nenhuma rota em `App.tsx`:

| Arquivo                          | Observação                                               |
| -------------------------------- | -------------------------------------------------------- |
| `src/pages/FeynmanTrainer.tsx`   | A rota `feynman` agora redireciona para `/dashboard/chatgpt` (App.tsx:175). Página standalone perdeu função. |
| `src/pages/Landing.tsx`          | Substituída por `Index.tsx`/`Institutional.tsx`. Sem importadores. |
| `src/pages/StudyPlan.tsx`        | Substituída por `SmartPlanner.tsx` + `OperationalHub`. Sem importadores. |

**Risco de remoção:** baixo. **Recomendação:** mover para `archive/` ou deletar.

---

## 3. Componentes `dashboard/` não importados (61 de 70)

O `Dashboard.tsx` atual (Visão Geral pós-refatoração) usa apenas:

- `MissionHeroAnimated` (de `dashboard-v2/`)
- `RecoveryModeBanner`
- `DashboardTopBar`
- `useFocusMode` (de `guided/FocusModeEntry`)

Os 9 arquivos ainda importados em algum lugar do projeto:

```
ActiveVideoRoomPopup.tsx       NotificationBell.tsx
DashboardTopBar.tsx            PerformanceReport.tsx
EvolutionBadge.tsx             ProficiencyGate.tsx
RecoveryModeBanner.tsx         StudyTimer.tsx
TopicEvolution.tsx
```

Os **61 restantes** são resíduo do dashboard v1 anterior à refatoração Visão Geral / Estudar:

<details>
<summary>Lista completa (clique para expandir)</summary>

```
ActiveVideoRoomBanner.tsx        AdaptiveModeCard.tsx
AdaptiveProgressDashboard.tsx    AdminMessagesBanner.tsx
AdvancedAnalyticsAccordion.tsx   ApprovalScoreCard.tsx
ApprovalThermometer.tsx          ApprovalTimeline.tsx
BehavioralAlerts.tsx             ContentLockStatusCard.tsx
CurriculumCoverageCard.tsx       DailyGoalWidget.tsx
DailyPlanWidget.tsx              DashboardCharts.tsx
DashboardMetricsGrid.tsx         DashboardSummaryCard.tsx
DiagnosticSummaryCard.tsx        EndOfDaySummary.tsx
ErrorReviewCard.tsx              ExamReadinessCard.tsx
ExamSetupReminder.tsx            FeedbackSurveyPopup.tsx
FocusSelector.tsx                FreeStudyCard.tsx
FsrsReviewCard.tsx               GuidedFlowLayer.tsx
HeroStudyCard.tsx                InstallAppBanner.tsx
InterventionCard.tsx             MentorshipBanner.tsx
MiniLeaderboard.tsx              MissionStartButton.tsx
MotivationalGreeting.tsx         OnboardingChecklist.tsx
OnboardingTour.tsx               PendingReviewsCard.tsx
PersonalGoalsCard.tsx            PracticalPerformanceCard.tsx
PracticalTrainingCard.tsx        PreparationIndexCard.tsx
ProgressOverview.tsx             QuickStartCard.tsx
RecentProgressCard.tsx           ResumeMissionBanner.tsx
SmartAlertCard.tsx               SmartNotifications.tsx
SmartRecommendations.tsx         SpecialtyBenchmark.tsx
SpecialtyLevelsCard.tsx          SpecialtyProgressCard.tsx
StreakBanner.tsx                 StreakCalendar.tsx
SystemGuidePopup.tsx             TodayStudyCard.tsx
TutorContinueCard.tsx            WeakTopicsCard.tsx
WeeklyEvolutionBar.tsx           WeeklyGoalsCard.tsx
WeeklyProgressCard.tsx           WeeklySummaryCard.tsx
WhatsNewPopup.tsx                ...
```

Lista exata persistida em: `/tmp/orphan_dashboard.txt`

</details>

**Risco de remoção:** **baixo a médio**. Nenhum import direto em `src/`, mas pode haver:
- Strings dinâmicas (improvável — Vite/React não suporta `lazy(() => import(\`./\${name}\`))` puro);
- Exports tipo (improvável — são componentes default).

**Recomendação:**
1. **Não deletar de uma vez.** Mover a pasta inteira para `src/_archive/dashboard-v1/` em uma sprint dedicada. Build deve continuar verde.
2. Se build passar e smoke test passar, deletar `_archive/` 1–2 sprints depois.

---

## 4. Padrões observados

- O `Dashboard.tsx` atual encolheu drasticamente após a refatoração Visão Geral, mas a pasta `dashboard/` não foi limpa — ficaram 61 arquivos órfãos (~390 KB).
- Existe um diretório `dashboard-v2/` com 9 arquivos, todos parecendo a "nova geração". O nome `v2` virou ambíguo agora que `v1` está morto — vale renomear `dashboard-v2/` para algo descritivo (ex.: `mission-hero/`) numa sprint futura.

---

## 5. Próximos passos sugeridos (com sua aprovação)

| # | Ação                                                              | Risco | Esforço |
| - | ----------------------------------------------------------------- | ----- | ------- |
| 1 | Mover 3 páginas órfãs para `src/_archive/`                        | Zero  | 2 min   |
| 2 | Mover 61 componentes `dashboard/` órfãos para `src/_archive/`     | Baixo | 5 min   |
| 3 | Rodar `npm run check:all` + `npm run build` para validar          | Zero  | 1 min   |
| 4 | (Sprint futura) Deletar `_archive/` definitivamente               | Baixo | 1 min   |
| 5 | (Opcional) Renomear `dashboard-v2/` para nome descritivo          | Baixo | 5 min   |

**Nada acima destrói:** Visão Geral, Estudar, ENAFLIX, sidebar, bottom nav ou qualquer rota do menu. A refatoração é puramente de limpeza de superfície morta.
