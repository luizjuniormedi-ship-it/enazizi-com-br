# Refatoração Enterprise — BI + Gamificação + Dashboards ENAZIZI/ENAFLIX

Auditoria já gerou 5 relatórios em `.lovable/`. Agora é execução. Trabalho em **10 fases incrementais**, cada uma testável isolada, sem tocar em FSRS/TRI matemático, prompts IA, modelos, schema cognitivo ou rotas.

## Princípios invioláveis
- **Verdade dos dados:** widget sem dado real → `<DadosInsuficientesCard />` ou `return null`. Zero `Math.random()`, zero hardcode, zero "IA detectou" fake.
- **Uma fonte de ação:** toda prioridade principal sai de `useStudyNext()`. Mission/Planner/Recovery/CTA derivam, não competem.
- **Dashboard ≠ Cockpit:** Dashboard = emocional/foco único. Cockpit = analítico/FSRS+TRI.
- **Gamificação adulta:** remover "Rei das Questões" etc. → Domínio, Retenção, Estabilidade, Evolução.
- **Professor operacional:** lista priorizada de alunos em risco com ações, não galeria de gráficos.

## Fases

### Fase 1 — Limpeza crítica (PRIORIDADE MÁXIMA)
- Remover `Math.random()` em `Dashboard.tsx:289` → fallback honesto.
- Remover 8 cards hardcoded de especialidades (`Dashboard.tsx:297-355`) → derivar de `user_topic_profiles` real ou esconder.
- Criar `<DadosInsuficientesCard />` reutilizável.
- Esconder com `data?.length ? ... : null`: Rankings, ApprovalPredictor, ApprovalScoreCard vazio, WeakTopics vazio, TopicEvolution vazio.

### Fase 2 — Arquitetura Dashboard
Reduzir Dashboard.tsx a:
1. `UnifiedMissionHero` (1 CTA único: "Continuar missão" do `useStudyNext`)
2. 3 KPIs: revisões vencidas, tempo estudado, consistência
3. RecoveryCard (condicional)
4. Próxima ação (derivada de `useStudyNext`)
5. ENAFLIX rows
Remover: analytics profundos, múltiplos heroes, excesso de cards.

### Fase 3 — Cockpit Cognitivo
Reorganizar `CognitiveCockpit` em ordem operacional:
- Theta TRI · Retenção FSRS · Stability · Lapses · Recovery Load
- Weak Topics · Evolução · Heatmap
- Curva de retenção · Especialidades críticas

### Fase 4 — Consolidação de componentes
- **Heroes** → `UnifiedMissionHero` (mescla DashboardHero, CinematicMissionHero, MissionHeroAnimated, CockpitHero)
- **Alertas** → `AlertOrchestrator` com priority queue + cooldown + agrupamento (mescla SmartAlerts, BehavioralAlerts, SmartAlertCard, NotificationBell, SmartNotifications)
- **Professor** → `ProfessorCommandCenter` (mescla ClassAnalytics + ProfessorBIPanel; reduz 12 abas → 4-5)

### Fase 5 — Professor Enterprise
Criar painel **"Alunos em risco hoje"**:
- Query: queda de retenção, perda de streak, lapses altos, abandono FSRS, queda de theta, burnout risk
- Cada linha: nome · motivo · gravidade · ações [Atribuir Recovery] [Mentoria] [Replanejar]
- Heatmap coletivo por especialidade/turma/dificuldade

### Fase 6 — Gamificação cognitiva
- Renomear achievements infantis → adultos profissionais (sem migração de schema; só labels/UI)
- Reduzir peso de conquistas por volume; destacar retenção/estabilidade
- Novos labels: "7 dias sem lapses", "Stability > 80", "Theta ↑ 0.5", "Recovery concluído"
- StreakInteligente: tolerância para feriado/burnout (lógica client-side em cima do streak existente)

### Fase 7 — Performance & Mobile
- Reduzir `min-h-[500px]` → `min-h-[340px]` em widgets mobile
- Lazy loading + Suspense + skeletons no Dashboard
- Deduplicar queries via React Query keys

### Fase 8 — Reativar pipelines de dados
- Cron diário `ranking_snapshots` (edge function + pg_cron)
- Backfill `user_topic_profiles` (edge function on-demand quando usuário entra no Cockpit)
- Reativar `approval_scores` snapshot diário
*(estes 3 são os únicos itens que tocam edge functions; nenhum altera schema)*

### Fase 9 — UX premium
- Reduzir glow/animações excessivas
- Hierarquia tipográfica clara
- Espaçamento generoso

### Fase 10 — Dead code
- Auditar `dashboard-v2/*` → mover não usado para `legacy_archive/` ou deletar imports órfãos

## Ordem de execução proposta
**Esta resposta entrega Fases 1 + 2 + parcial 4 (UnifiedMissionHero + AlertOrchestrator)** — os blocos com maior impacto/risco e que destravam o resto. Fases 3, 5, 6, 7, 8, 9, 10 ficam para próximas iterações curtas (cada uma um prompt focado), evitando uma mega-PR difícil de revisar.

## Arquivos previstos nesta primeira leva
- `src/components/common/DadosInsuficientesCard.tsx` (novo)
- `src/components/dashboard/UnifiedMissionHero.tsx` (novo)
- `src/components/alerts/AlertOrchestrator.tsx` (novo)
- `src/pages/Dashboard.tsx` (refator: remove random/hardcode, slim layout)
- Stubs de export para manter retrocompat de imports antigos

## O que NÃO vou tocar
FSRS math · TRI · prompts IA · modelos · schema DB · rotas · auth · provider tree · planner core · tutor core · ENAFLIX core · admin.

## Entregáveis
1. Código das Fases 1+2+4 parcial
2. `.lovable/refactor-phase-1-2-report.md` com diff arquitetural e roadmap das fases restantes
3. Confirmação de smoke test no preview (430px)

Aprovar para eu executar Fases 1-2 + UnifiedMissionHero + AlertOrchestrator agora.
