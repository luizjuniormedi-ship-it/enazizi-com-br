# Reset Plano de Estudo — Finalização (v2)

## Causa raiz remanescente
- `generate-daily-plan` e `study-orchestrator` recompunham o "plano de hoje" lendo
  `revisoes`, `error_bank`, `desempenho_questoes` e `temas_estudados` SEM filtrar
  pelo marcador `last_study_plan_reset_at`. Resultado: mesmo após o reset,
  reapareciam revisões, erros e temas antigos como jornada atual.
- `CronogramaInteligente` carregava todos os temas/revisões/desempenhos do usuário
  e usava o mesmo conjunto em TODAS as abas — inclusive Visão, Hoje, Temas,
  Críticos e Gráficos — sem distinguir histórico vs jornada atual.

## Arquivos alterados nesta iteração
- `supabase/functions/generate-daily-plan/index.ts`
  - Lê `profiles.last_study_plan_reset_at` no início.
  - Aplica fence em `revisoes` (`gt created_at`), `error_bank` (`gt updated_at`),
    `desempenho_questoes` (`gt data_registro`) e `temas_estudados` (`gt created_at`).
- `supabase/functions/study-orchestrator/index.ts`
  - Lê `profiles.last_study_plan_reset_at` no início.
  - Aplica fence em `revisoes` e usa janela `max(7d, resetAt)` para `error_bank`.
- `src/pages/CronogramaInteligente.tsx`
  - Carrega DOIS conjuntos: jornada atual (com fence) e histórico completo.
  - Visão / Hoje / Novo / Temas / Críticos / Gráficos / Plano usam o conjunto
    pós-reset.
  - Aba **Histórico** continua mostrando todo o histórico pedagógico.

## Tabelas limpas/encerradas pelo reset (já vigente)
- `daily_plans`, `daily_plan_tasks`, `study_plans`, `study_tasks` — DELETE
- `module_sessions` ativos → `abandoned`
- `recovery_runs` ativos → `active=false, ended_at=resetAt`
- `trajectory_applied_actions` em estados ativos → `status='reset'`
- `dashboard_snapshots.updated_at` → 2000-01-01 (stale)
- `profiles.last_study_plan_reset_at` → agora (marcador temporal)
- localStorage/sessionStorage: missão, planner, loop, focus, EOD, ENAFLIX origin

## Tabelas preservadas (histórico pedagógico intocado)
- `fsrs_cards`, `flashcard_reviews`, `flashcards`
- `error_bank` (registros mantidos; apenas filtrados na visualização atual)
- `temas_estudados`, `revisoes`, `desempenho_questoes` (mantidos; aba Histórico expõe todos)
- `chat_conversations`, simulados, mapas mentais, `mnemonic_results`
- `user_question_attempts`, `performance_unified`, `module_sessions` finalizados
- gamificação, streak, XP, perfil

## Componentes/funcoes que agora respeitam `last_study_plan_reset_at`
- Dashboard: `useCoreData`, `useDashboardData`, `useDashboardMnemonic`,
  `TutorContinueCard`, `CinematicMissionHero` (via `study-next`)
- Hoje: `DailyPlan` (revisoes, performance_unified, temas_estudados)
- Planner: `SmartPlanner` (tarefas, revisões, recovery)
- Cronograma: `CronogramaInteligente` (visão, hoje, temas, críticos, gráficos)
- Backend: `study-next`, `cockpit-data`, `generate-daily-plan`, `study-orchestrator`

## Confirmação
- Plano do Dia, Cronograma (jornada atual), Hoje, Continuar e widgets do
  Dashboard não exibem mais dados anteriores ao último reset.
- Aba Histórico do Cronograma, página de FSRS, banco de erros (página própria),
  Tutor histórico, Simulados realizados e Mnemônicos salvos continuam acessíveis.

## Validação
- `npx tsc --noEmit` → **0 erros**
- Erros pré-existentes em edge functions não relacionadas
  (`admin-actions`, `auto-assign-simulados`, `_shared/ai-cache.ts`) NÃO foram
  introduzidos por esta alteração e permanecem fora de escopo.

## Não alterado
- Motores pedagógicos (FSRS, scoring, prompt mestre, prioridades)
- Telemetria observacional / freeze observacional
- Shadow Mode (continua desligado)
- Nomenclatura, sidebar, fluxo do aluno
