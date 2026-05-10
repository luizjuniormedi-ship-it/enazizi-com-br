# Relatório Final — Auditoria BI + Gamificação ENAZIZI/ENAFLIX
Gerado: 2026-05-10 · Auditoria read-only · Zero alterações de código/IA/FSRS-TRI

> Documentos correlatos:
> - `.lovable/bi-inventory-report.md`
> - `.lovable/bi-aluno-audit.md`
> - `.lovable/bi-professor-audit.md`
> - `.lovable/gamification-audit.md`

---

## 1. INVENTÁRIO (resumo)
- **35+ widgets** no dashboard do aluno
- **12 abas** no painel professor
- **~15 painéis** admin/operacionais
- **5 zonas de redundância** identificadas
- **3 fontes de dados mortas em produção**

## 2. PAINEL ALUNO
- 2 narrativas concorrentes (Dashboard cinemático vs CognitiveCockpit)
- **Hero do Dashboard contém mocks ainda em produção** (`Math.random()` na linha 289, 8 cards hardcoded de "Cardiologia/Pediatria/...")
- KPIs de volume são reais; KPIs de qualidade (approval, topic profile) **mortos para 95% dos usuários**
- Mobile: hero ocupa toda a viewport antes do scroll

## 3. PAINEL PROFESSOR
- 12 abas sem hierarquia → fadiga
- `ClassAnalytics` ⇄ `ProfessorBIPanel` redundantes
- **Falta painel acionável "Alunos em risco hoje"**
- Sem agregação FSRS/TRI por turma
- Heatmap coletivo ausente

## 4. GAMIFICAÇÃO
- 24/37 achievements premiam **volume** (não aprendizado real)
- 3 achievements baseados em `approval_scores` **inalcançáveis** (tabela morta)
- Tom estudantil/infantil destoa do posicionamento premium
- Página `/dashboard/rankings` **completamente vazia** (1 snapshot, parou em março)
- Zero integração TRI

## 5. PAINÉIS DIÁRIOS
- Mission + Daily Plan + Recovery: bem integrados, dados reais
- Linguagem "missão" duplicada em 2 lugares
- Pomodoro não persiste sessão
- 5+ popups sem fila clara de prioridade

## 6. KPIs — qualidade
| KPI | Saúde |
|---|---|
| Questões/Acerto/Streak/Revisões/FSRS/Errors | ✅ |
| Approval Score / Performance Predictor | ❌ pipeline morto |
| Rankings (4 categorias) | ❌ vazio |
| Topic Evolution / WeakTopics | ❌ 4 users de 184 |
| Engagement/Fatigue scores | ⚠️ hardcoded 0 |

## 7. FSRS / TRI
- **FSRS**: bem visualizado no aluno (3 surfaces). Falta retenção como gráfico.
- **TRI**: existe na engine, **invisível ao aluno e professor**. Achievement TRI = 0.

## 8. UX/UI
- Cinematic style (Netflix-medical) bonito mas pesado em mobile
- 5 sistemas de alerta paralelos
- Múltiplos heroes concorrentes (Dashboard / CinematicMissionHero v2 / MissionHeroAnimated)
- `dashboard-v2/*` provavelmente dead code coexistindo

## 9. MOBILE (430×661 real)
- Hero 500px obriga scroll para qualquer KPI
- Tabs do professor viram 6 linhas
- DashboardMetricsGrid responsivo OK
- ENAFLIX rows com scroll-X funcionam

## 10. PERFORMANCE
- Dashboard: lazy load de `ProgressOverview` e `MedicalMasteryDashboard` ✅
- Imagem hero do Unsplash externa, sem `loading="lazy"` explícito
- Cockpit: paralelismo via edge `cockpit-data` ✅
- React Query: staleTime razoável (5min em useDashboardData, 60s em cockpit)

## 11. DADOS REAIS — score
| Categoria | % real |
|---|---|
| Atividade básica (questões/streak/revisões) | 100% |
| Curva de aprendizado individual | 25% (tabelas mortas) |
| Ranking social | 0% |
| Hero principal do Dashboard | 30% (mocks) |
| Painel professor | 95% |
| Admin | 100% |

## 12. REDUNDÂNCIAS (top)
1. Dashboard hero ↔ Cockpit Hero ↔ MissionHeroAnimated ↔ CinematicMissionHero (v2)
2. Rankings ↔ Achievements weekly ranking ↔ MiniLeaderboard
3. Analytics page ↔ Cockpit Performance ↔ DashboardMetricsGrid (KPIs repetidos)
4. ClassAnalytics ↔ ProfessorBIPanel
5. SmartAlerts ↔ BehavioralAlerts ↔ SmartAlertCard ↔ SmartNotifications ↔ NotificationBell

## 13. PROBLEMAS POR PRIORIDADE

### 🔴 CRÍTICO (corrigir antes de escalar)
1. Remover `Math.random()` mock no Dashboard linha 289
2. Substituir 8 cards hardcoded do Dashboard hero por dados reais (`useStudyNext`)
3. Reativar cron `ranking_snapshots` — toda a página /rankings está vazia
4. Reativar pipeline `approval_scores` — 30%+ dos KPIs e 3 achievements dependem
5. Backfill `user_topic_profiles` (hoje 4 de 184 users)

### 🟠 ALTO
6. Decidir narrativa Dashboard cinemático vs Cockpit — uma só
7. Painel professor: "Alunos em risco hoje" + heatmap coletivo + agrupar 12 abas → 5
8. Unificar `ClassAnalytics` + `ProfessorBIPanel`
9. Reduzir 5 sistemas de alerta para 1 (`useAlertOrchestrator` já existe)
10. Confirmar/remover `dashboard-v2/*` se for dead code
11. Gamificação: rebalancear achievements para evolução (FSRS stability, TRI θ)
12. Modo silencioso de gamificação opcional

### 🟡 MÉDIO
13. Mobile: reduzir hero 500→340px
14. Expor TRI/theta ao aluno e à turma
15. Persistir Pomodoro
16. Consolidar popups em fila com prioridade
17. Reduzir CAPS LOCK no painel professor
18. Calcular Engagement/Fatigue scores em runtime (hoje hardcoded 0)

### 🟢 BAIXO
19. CTA em EvolutionBadge / WeeklySummaryCard
20. Substituir emojis por iconografia consistente
21. Streak inteligente honrando avisos de ausência

## 14. QUICK WINS (≤1 dia cada)
- [QW1] **Remover linha 289** de Dashboard.tsx (mock progress) → ler progresso real do `enaflixUsage` ou ocultar barra
- [QW2] **Esconder `/dashboard/rankings`** da sidebar até cron rodar (evita página vazia)
- [QW3] **Esconder ApprovalScoreCard quando `score === null`** (evita "—" em todo o app)
- [QW4] **Trocar 5 cards de tema hardcoded** por `cockpit.topWeaknesses.slice(0,5)` ou `studyNext.alternativeActions`
- [QW5] **Mover `dashboard-v2/*` para `legacy_archive/`** após confirmar não-uso (`rg "from.*dashboard-v2"`)
- [QW6] **Diminuir altura do hero** mobile (`min-h-[340px] sm:min-h-[500px]`)
- [QW7] **Unificar tabs do professor** em 5 grupos via sub-Tabs

## 15. RISCOS
- **Aluno novo entra → vê mocks → perde confiança no produto**: o conteúdo hardcoded ("Risco de esquecimento alto detectado pela IA") aparece **mesmo para usuários sem nenhum dado**, simulando IA inexistente.
- **Página de rankings vazia** vira meme negativo na primeira semana de release.
- **Approval Score morto** invalida discurso de "preparation index 0-100".
- **Painel professor** se tornou inutilizável por overload — risco de churn de mentores.

## 16. KPIs FALTANDO
- TRI/theta visível
- Retention curve FSRS (gráfico)
- Stability médio por especialidade
- Heatmap coletivo de turma
- Top alunos em risco (professor)
- Tempo médio até primeira ação (TTFA)

## 17. DASHBOARDS PARA REMOVER / ARQUIVAR
- `dashboard-v2/*` (após confirmação)
- `MiniLeaderboard` (sobreposto a Rankings/Achievements)
- 1 dos 2 painéis BI do professor (`ClassAnalytics` ou `ProfessorBIPanel`)

## 18. DASHBOARDS QUE PRECISAM REDESIGN
- Dashboard.tsx (remover hardcoded, integrar Cockpit ou substituir hero)
- ProfessorDashboard tabs (12 → 5 grupos)
- Rankings page (após reativar pipeline)

## 19. VEREDITO FINAL

| Pergunta | Resposta honesta |
|---|---|
| Parece premium? | **Em parte.** O ENAFLIX cinematic style é premium; o conteúdo hardcoded e as páginas vazias quebram a percepção. |
| Parece profissional? | **Painel professor sim, painel aluno não 100%** — mocks e páginas mortas comprometem. |
| Pronto para escala? | **NÃO** sem corrigir os 5 itens críticos. Estruturalmente sim; experiencialmente não. |
| Gamificação funciona? | **Parcialmente.** XP/streak/achievements ativos. Rankings mortos. Achievements premiam volume mais que aprendizado. |
| BI gera ação prática? | **Aluno: parcial** (Cockpit gera, Dashboard hero não). **Professor: insuficiente** — falta "alunos em risco hoje". |
| Quais dashboards são realmente úteis? | Cockpit, DashboardMetricsGrid, Mission, Planner, Achievements, painel professor (Simulados/Plantão/Mentoria/Proficiência/OSCE), AdminCEO, ProductMetrics. |
| Quais devem ser removidos? | `dashboard-v2/*`, `MiniLeaderboard`, um dos dois BIs do professor. |
| Quais precisam redesign? | Dashboard hero, Rankings (após reativar), tabs do professor. |
| Quais KPIs faltam? | TRI/θ, retention curve FSRS, heatmap coletivo de turma, top-risk alunos. |

---

### Selo final
**ESTRUTURA: pronta para escala.**
**EXPERIÊNCIA: bloqueada por 5 itens CRÍTICOS** (mocks no hero + 3 pipelines mortos + redundâncias).
Após resolver os 5 críticos + 7 altos, o produto pode ser apresentado como **BI/Gamificação grau enterprise educacional**.
