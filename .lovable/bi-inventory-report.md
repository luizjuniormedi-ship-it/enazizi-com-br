# BI / Painéis — Inventário Completo
Gerado: 2026-05-10 · Escopo: ENAZIZI/ENAFLIX · Auditoria read-only

> Status legend: ✅ ativo+real · ⚠️ parcial / dados rasos · ❌ mock/fake/vazio · 🔁 redundante com outro painel

## 1. Painéis do ALUNO

| Painel / Widget | Rota | Fonte | Real? | Problema |
|---|---|---|---|---|
| Dashboard Hero (Netflix-style) | `/dashboard` | hardcoded + `useEnaflixUsage` | ❌ | `progress = Math.random()*90+10` (linha 289). Cards "Pediatria/Cirurgia/Gineco" totalmente estáticos |
| Temas Populares (5 cards) | `/dashboard` | **hardcoded** | ❌ | Não usa `medical_domain_map` nem `user_topic_profiles` |
| Revisões Recomendadas (3 cards) | `/dashboard` | **hardcoded** | ❌ | Textos ficcionais ("queda de 12%") sem origem |
| ProgressOverview | `/dashboard` (lazy) | `useDashboardData` | ✅ | OK |
| MedicalMasteryDashboard | `/dashboard` (lazy) | `medical_domain_map` | ⚠️ | 163 rows existentes mas só 4 users com `user_topic_profiles` |
| **CognitiveCockpit** (paralelo) | usado em outras rotas | edge `cockpit-data` | ✅ | 🔁 Redundante: Dashboard cinemático e Cockpit competem pela mesma narrativa |
| DashboardMetricsGrid (4 KPIs + 13 secundários) | embed | `useDashboardData` | ✅ | 🔁 KPIs também aparecem em Analytics e Cockpit |
| ApprovalScoreCard / Thermometer / Timeline | embed | `approval_scores` | ❌ | **9 rows totais; nenhuma desde abril**. Widget mostra valor nulo p/ ~95% dos usuários |
| PreparationIndexCard | embed | `usePreparationIndex` | ✅ | OK |
| ExamReadinessCard | embed | `useExamReadiness` | ✅ | OK |
| StreakBanner / StreakCalendar | embed | `user_gamification` | ✅ | OK |
| MissionStartButton / Hero CTA | embed | `useStudyNext` | ✅ | OK |
| FsrsReviewCard / PendingReviewsCard | embed | `revisoes`+`fsrs_cards` | ✅ | 380/429 rows — saudável |
| WeakTopicsCard / TopicEvolution | embed | `user_topic_profiles` | ⚠️ | só 4 users com dados; 95% verão vazio |
| ErrorReviewCard / Banco de Erros | `/dashboard/banco-erros` | `error_bank` | ✅ | 262 rows |
| Recovery banners | embed | adaptive engine | ✅ | OK |
| Smart Alerts / Behavioral Alerts | embed | telemetry | ⚠️ | Múltiplos componentes p/ mesma função |
| Mission Mode | `/mission` | `useMissionMode` | ✅ | OK, mas idle screen sobreposta a Dashboard hero |
| Daily Plan widgets | `/dashboard` + `/dashboard/planner` | `daily_plans` | ✅ | OK |
| Smart Planner | `/dashboard/planner` | hooks múltiplos | ✅ | OK |
| Analytics page | `/dashboard/analytics` | múltiplas tabelas | ✅ | 🔁 Replica accuracy/heatmap/radar do Dashboard |
| Achievements + Weekly Ranking | `/dashboard/conquistas` | `user_gamification` + `user_achievements` | ✅ | 🔁 Sobrepõe com `/dashboard/rankings` |
| Rankings (4 categorias) | `/dashboard/rankings` | `ranking_snapshots` via RPC | ❌ | **1 row total, parou em março**. Toda a página mostra "rankings serão calculados em breve" |
| ENAFLIX Catalog | `/enaflix`, `/enaflix/tudo` | `useEnaflixPersonalizedRows` | ✅ | OK |
| Performance Predictor | `/dashboard/predictor` | `useApprovalPrediction` | ⚠️ | Depende de approval_scores (mortas) |
| Radar Trajetória | `/dashboard/radar-trajetoria` | trajectory edge fns | ✅ | OK |
| Minha Jornada | `/dashboard/minha-jornada` | `useAdaptiveJourney` | ✅ | OK |
| Mapa de Domínio | `/dashboard/mapa-dominio` | `medical_domain_map` | ✅ | OK |
| Proficiência (aluno) | `/dashboard/proficiencia` | hooks proficiency | ✅ | OK |

## 2. Painéis do PROFESSOR

| Painel | Rota | Fonte | Real? | Problema |
|---|---|---|---|---|
| Painel principal (12 tabs) | `/dashboard/professor` | `professor-simulado` edge | ✅ | **Overload** — 12 tabs sem agrupamento |
| Simulados + KPI cards | tab `simulados` | `teacher_simulado_results` | ✅ | OK |
| Casos Plantão | tab `plantao` | edge | ✅ | OK |
| Video Room | tab `video` | edge + meet links | ⚠️ | room code com `Math.random()` (aceitável p/ id) |
| Temas / Atribuições | tab `temas` | edge | ✅ | OK |
| Aluno (StudentTracker) | tab `alunos` | edge | ✅ | OK |
| Minhas Turmas | tab `turmas` | edge | ✅ | OK |
| Turma BI (ClassAnalytics) | tab `analytics` | edge | ⚠️ | 🔁 Sobrepõe com tab `bi` |
| Painel BI (ProfessorBIPanel) | tab `bi` | edge | ⚠️ | 🔁 Funções similares a `analytics` |
| Mentoria (MentorThemePlans) | tab `mentoria` | edge | ✅ | OK |
| OSCE (Practical Exams) | tab `osce` | edge | ✅ | OK |
| Proficiência (Plans) | tab `proficiencia` | edge | ✅ | OK |
| Auditoria (Trace) | tab `auditoria` | edge | ✅ | OK |
| Mentorship Report | embed | edge | ✅ | OK |

## 3. Painéis ADMIN / Operacional

| Painel | Rota | Real? |
|---|---|---|
| Centro de Comando | `/admin` | ✅ |
| AdminCEO | `/admin/ceo` | ✅ (corrigido `practice_attempts.correct`) |
| Product Metrics (funnel/retention/trend) | `/admin/metrics` | ✅ |
| AdminMonitoring | `/admin/monitoring` | ✅ |
| Orchestrator Insights | `/admin/orchestrator-insights` | ✅ |
| ValidationDashboard / Coverage / CME / Curriculum | múltiplas | ✅ |
| AdminGovernanceLogs / AdaptiveExperiments / InterventionPolicies | múltiplas | ✅ |

## 4. Painéis Diários

| Painel | Rota | Real? | Problema |
|---|---|---|---|
| Mission idle screen | `/mission` | ✅ | OK |
| MissionTaskList / Actions / Progress / Impact | embed | ✅ | OK |
| DailyPlanWidget / Progress / NextTaskBanner | dashboard + planner | ✅ | OK |
| TodayStudyCard | dashboard | ✅ | OK |
| EndOfDaySummary | dashboard | ⚠️ | Sem trigger automático claro |
| Recovery Mode Banner | dashboard | ✅ | OK |
| PomodoroTimer | embed | local-only | ⚠️ | Timer não persiste sessão |

## 5. Métricas FSRS / TRI

| Onde aparece | Real? | Observação |
|---|---|---|
| FsrsReviewCard, PendingReviewsCard, useFsrs, useFsrsDueCount | ✅ | 429 fsrs_cards, 380 revisoes |
| Cockpit (avgStability, totalLapses, fsrsDueCount) | ✅ | OK |
| Planner FSRS Section | ✅ | OK |
| TRI (3PL) — Simulado prova real | ✅ | OK em exam_sessions |
| Cockpit FSRS visualization | ⚠️ | apenas 4 KPIs simples — falta gráfico de retenção |

## 6. Resumo quantitativo

- **35+ widgets** identificados em rotas do aluno
- **12 tabs** no painel professor
- **~15 painéis admin**
- **5 hotspots de redundância**: Dashboard vs Cockpit · Achievements vs Rankings · Analytics vs Cockpit · ClassAnalytics vs ProfessorBIPanel · DashboardMetricsGrid vs ProgressOverview
- **3 fontes de dados quebradas/mortas em produção**:
  - `ranking_snapshots` (1 row, fev/mar)
  - `approval_scores` (9 rows, parou em abril)
  - `user_topic_profiles` (4 users de 184)
- **2 mocks ainda no código de produção do Dashboard hero** (Math.random + cards estáticos)
