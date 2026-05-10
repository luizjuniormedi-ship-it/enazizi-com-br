
# Auditoria Completa BI + Gamificação + Painéis — ENAZIZI/ENAFLIX

## Escopo
Auditoria **read-only / diagnóstica**. Nenhum código de produto, prompt, modelo IA, FSRS/TRI ou payload será alterado. Saída = relatórios em `.lovable/`.

## Entregáveis (5 arquivos)

1. **`.lovable/bi-inventory-report.md`** — Inventário completo
   Tabela: `painel | rota | perfil (aluno/prof/admin) | status | fonte de dados | dados reais? | problema`
   Cobertura: Dashboard, ENAFLIX, Planner, Missão diária, Recovery, Simulados, Analytics, Approval Score, Chance por banca, Performance por tema, Heatmap erros, FSRS, TRI, Timeline, Ranking, XP, Streak, Badges, painéis professor (turma, risco, heatmap, engajamento, FSRS/TRI coletivo), painéis admin/CEO.

2. **`.lovable/bi-aluno-audit.md`** — Auditoria aluno
   - Hierarquia visual, redundâncias (ex: Cockpit vs DashboardMetricsGrid)
   - KPIs fake/placeholder vs reais
   - Mobile (430px atual)
   - Conexão real com FSRS/TRI/approval_scores
   - Gamificação infantilizada vs profissional
   - Widgets sem ação prática

3. **`.lovable/bi-professor-audit.md`** — Auditoria professor
   - Capacidade de ação (aluno em risco, queda, abandono, burnout)
   - KPIs duplicados, rankings úteis vs ruído
   - FSRS/TRI coletivo
   - Overload visual
   - Decisão prática por painel

4. **`.lovable/gamification-audit.md`** — Gamificação
   - XP, níveis, streak, badges, achievements, rankings
   - Integração real com FSRS/TRI (reforça aprendizado ou só decora?)
   - Risco de compulsão / competitividade tóxica
   - Profissional vs infantil
   - Painéis diários (missão, recovery, agenda) — coerência, timezone, duplicação

5. **`.lovable/final-bi-gamification-audit.md`** — Relatório final consolidado
   Seções: Inventário · Aluno · Professor · Gamificação · Painéis Diários · KPIs · FSRS/TRI Analytics · UX/UI · Mobile · Performance · Dados Reais · Redundâncias · Problemas · Melhorias · Quick Wins · Riscos · Prioridades (CRÍTICO/ALTO/MÉDIO/BAIXO) · **Veredito Final**.
   Responde: premium? profissional? pronto p/ escala? gamificação funciona? BI gera ação? quais dashboards remover/redesign? quais KPIs faltam?

## Metodologia (como vou auditar)

**Fase A — Mapeamento estático**
- `rg` para listar todas as rotas em `src/App.tsx` / `src/constants/routes.ts`
- Listar `src/pages/` (aluno, professor, admin) e `src/components/{dashboard,cockpit,dashboard-v2,enaflix,planner,daily-plan,gamification,professor,product-metrics,analytics,radar,proficiency}/`
- Identificar hooks de dados: `useCockpitData`, `useDashboardData`, `useStudyNext`, `useOrchestrator`, `useMonthlyGoal`, `useProductMetrics`, planner/professor hooks

**Fase B — Validação de dados reais**
- Para cada widget: rastrear hook → query Supabase / edge function → tabela real
- Cruzar com `dashboard-snapshot`, `approval_scores`, `practice_attempts`, `revisoes`, `user_gamification`, `error_bank`, `medical_domain_map`, `exam_sessions`
- `supabase--read_query` em amostras para detectar campos sempre nulos / sempre zero / mock
- Flag: dados reais ✅ · cache stale ⚠️ · placeholder/mock ❌

**Fase C — Validação UX/UI/mobile**
- `browser--navigate_to_sandbox` + `browser--screenshot` em rotas-chave (dashboard, planner, missão, ENAFLIX, professor, ranking) em **mobile 430px** e **desktop 1366px**
- `image_tools--zoom_image` para verificar legibilidade, overflow, hierarquia
- `browser--performance_profile` em painéis pesados (Cockpit, ProductMetrics, professor)
- `code--read_console_logs` + `code--read_network_requests` para queries duplicadas / 4xx / 5xx

**Fase D — Análise pedagógica + gamificação**
- Cruzar gamificação (`user_gamification`, achievements) com FSRS reviews e approval_score → mede integração
- Detectar: streaks que premiam volume sem qualidade, XP sem reforço cognitivo, badges decorativos
- Avaliar painel professor: cada KPI gera decisão? (intervir, reforçar, atribuir)

**Fase E — Classificação e veredito**
- Cada achado: impacto · risco · solução · prioridade
- Quick wins (≤1 dia) destacados
- Veredito final honesto, sem inflar

## Restrições
❌ Sem edição de código / prompts / modelos / FSRS-TRI / schema / payloads
❌ Sem redesign — só diagnóstico e recomendação
✅ Somente leitura, screenshots, queries SELECT, geração dos 5 .md

## Estimativa
~30–40 chamadas de ferramenta (rg + leitura de pages/hooks + ~12 screenshots mobile/desktop + ~10 queries SQL + escrita dos 5 relatórios). Resultado em uma única passada.
