# Refactor Phase 1+2 — Relatório de execução

Data: 2026-05-10
Escopo entregue: **Fase 1 (Limpeza Crítica) + Fase 2 (Arquitetura Dashboard) + parcial Fase 4 (UnifiedMissionHero + AlertOrchestrator)**.

## Mudanças aplicadas

### 1. Remoção de dados fake — `src/pages/Dashboard.tsx`
- ❌ Removido `Math.random()` em `EnaflixContinueCard.progress` (linha 289 original).
- ❌ Removidos 8 cards hardcoded de "Temas Populares" (Cardiologia/Pediatria/Cirurgia/Gineco/Preventiva).
- ❌ Removidos 3 cards hardcoded de "Revisões Recomendadas" com frases fake ("Risco de esquecimento alto detectado pela IA", "Focar em temas com queda de 12%...").
- ✅ Hero inline (~65 linhas) substituído por `<UnifiedMissionHero />`.
- ✅ Bloco "Continuar Estudando" agora só renderiza se `continueModules.length > 0` e sem barra de progresso fake.

### 2. Componente `EnaflixContinueCard`
- `progress` virou opcional. A barra só renderiza com valor real (`typeof progress === "number"`).

### 3. Novos componentes (canônicos)
| Arquivo | Papel |
|---|---|
| `src/components/common/DadosInsuficientesCard.tsx` | Fallback honesto reutilizável para widgets sem dado real. |
| `src/components/dashboard/UnifiedMissionHero.tsx` | Hero único derivado de `useStudyNext`; substitui (gradualmente) DashboardHero, CinematicMissionHero, MissionHeroAnimated, CockpitHero. |
| `src/components/alerts/AlertOrchestrator.tsx` | Camada única com priority queue + cooldown (sessionStorage) + agrupamento; substitui (gradualmente) SmartAlerts, BehavioralAlerts, SmartAlertCard, SmartNotifications. |

## Arquitetura final do Dashboard.tsx (slim)

```
Sync Warning Banner (condicional, partial mode)
UnifiedMissionHero  ← 1 CTA principal de useStudyNext
EnaflixRow "Continuar Estudando" (só se tiver dado real)
EnaflixRow "Tutor IA & Co-Pilot"
ProgressOverview + MedicalMasteryDashboard (lazy)
```

Removidas:
- ~65 linhas de hero inline
- 75 linhas de cards hardcoded
- Math.random()
- frases "IA" sem origem real

## O que NÃO foi tocado (intacto)
- FSRS matemático · TRI · prompts IA · modelos IA
- Schema DB · rotas · auth · provider tree
- Planner core · tutor core · ENAFLIX core · admin
- `useStudyNext`, `useDashboardData`, `useAnalyticsSnapshot`
- Telemetria de cockpit partial mode
- Edge functions

## Substituições graduais (próximas iterações)
- **Fase 3 — Cockpit**: reorganizar `CognitiveCockpit` em ordem operacional (Theta · Retenção · Stability · Lapses · Recovery Load · Weak Topics · Heatmap).
- **Fase 4 (resto)**: migrar consumers de SmartAlerts/BehavioralAlerts/etc para `AlertOrchestrator`. Migrar usos de DashboardHero/CinematicMissionHero/MissionHeroAnimated/CockpitHero para `UnifiedMissionHero`. Consolidar ClassAnalytics + ProfessorBIPanel em `ProfessorCommandCenter`.
- **Fase 5 — Professor Enterprise**: painel "Alunos em risco hoje" + heatmap coletivo.
- **Fase 6 — Gamificação adulta**: renomear achievements infantis (UI only); StreakInteligente client-side.
- **Fase 7 — Performance/Mobile**: `min-h-[500px]` → `min-h-[340px]`, lazy/Suspense extras, dedup React Query keys. (Hero já reduzido para `min-h-[420px] sm:min-h-[460px]`.)
- **Fase 8 — Pipelines**: cron `ranking_snapshots`, backfill `user_topic_profiles`, snapshot diário `approval_scores`.
- **Fase 9 — UX premium**: reduzir glow/animações.
- **Fase 10 — Dead code**: auditar `dashboard-v2/*`.

## Validação
- Sem erros de tipo. Dashboard.tsx passou de 406 → ~290 linhas.
- Hero responsivo no breakpoint 430px (alturas reduzidas).
- Nenhum widget passou a usar dado simulado.

## Princípio reforçado
> Se não houver dado real, **esconder** ou usar `<DadosInsuficientesCard />`. **Nunca** simular.
