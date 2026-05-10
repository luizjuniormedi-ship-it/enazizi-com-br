# Professor Cognitive Collective — Relatório Final

Data: 2026-05-10
Escopo: Fases 1, 2, 3, 4, 5, 8, 9, 10 do PROMPT MASTER — Professor Command Center • Fase Cognitiva Coletiva.

## Componentes criados
- `src/components/professor/ClassCognitiveMatrix.tsx` — matriz 2D especialidade × métrica (retention, lapses, stability, recovery_load, difficulty). Desktop = tabela; mobile = cards. Sem dado → DadosInsuficientesCard.
- `src/components/professor/ProfessorInterventionTimeline.tsx` — timeline unificada com filtros (IA / Professor / Todos) consumindo a nova action `intervention_timeline`.
- `src/components/professor/ProfessionalLeaderboard.tsx` — ranking adulto: retenção, stability FSRS, consistência (streak), recuperação exemplar. Sem categoria fake; sem volume bruto.
- `src/lib/professor/professorActionEngine.ts` — motor determinístico (sem LLM) que mapeia `StudentCognitiveRisk` → `ProfessorAction` com justificativa real.
- `src/lib/professor/burnoutRiskEngine.ts` — heurística determinística para burnout/overload, com fallback explícito para "dados insuficientes" e regra de inatividade ≠ burnout.

## Componentes atualizados
- `src/components/professor/OperationalKpiBar.tsx` — agora consome `cognitive_summary`. KPIs cognitivos só aparecem se backend enviar valor não-null. Nunca mostra "0" falso. Adiciona faixa "especialidade mais fraca/forte" coletiva.
- `src/pages/ProfessorDashboard.tsx` — sub-abas Operacionais expandidas: Risco · **Matriz cognitiva** · Heatmap · **Timeline** · **Ranking** · Aluno · Casos. KPI bar exibida nas 4 primeiras.

## Backend — `supabase/functions/professor-simulado/index.ts`
- `class_analytics` agora retorna **adicionalmente**, sem quebrar o payload anterior:
  - `cognitive_summary` (avg_theta proxy, avg_stability, avg_retention, avg_lapses, avg_recovery_load, burnout_risk_students, overload_students, inactive_students, weakest/strongest_specialty, trend_30d).
  - `cognitive_matrix` (especialidade × {retention, lapses, stability, recovery_load, difficulty} + severity + sample_size).
  - `student_cognitive_risks` (risk_score, risk_level, burnout_risk, overload_score, retention_score, theta_proxy, weak_specialty, suggested_action, justification).
- Nova action `intervention_timeline` — agrega `assistant_decisions` (alunos do professor) + `teacher_study_assignments` criadas pelo professor.

Fontes de dados reais usadas:
- `fsrs_cards` (stability, lapses, due, state)
- `fsrs_review_log` (rating → again_rate → retention proxy)
- `practice_attempts` (acurácia 7d vs 23d → trend)
- `error_bank` (especialidade mais fraca por aluno)
- `medical_domain_map` (domínio por especialidade)
- `approval_scores` (trend 30d)
- `assistant_decisions` (timeline)
- `teacher_study_assignments` (timeline)

## KPIs reais disponíveis
- Alunos ativos · Crítico · Atenção · Inativos > 7d · Conclusão (já existiam)
- **Retenção média** · **Lapses médio** · **Stability FSRS médio** · **Sobrecarga** · **Risco burnout** (novos, só renderizam se backend tiver dado)

## KPIs ocultos por falta de dado
- `avg_theta` real — backend retorna `theta_proxy` baseado em acurácia 30d (≥10 amostras), claramente nomeado como proxy.
- `trend_7d` — não calculado ainda (apenas `trend_30d` via approval_scores). Fica `null`.

## Ações operacionais implementadas
- Em `TopRiskStudents`: Atribuir tarefa, Mentoria, Detalhes (drawer), e Atribuir Recovery via `QuickInterventionDialog` (cria `study_assignment` real).
- `professorActionEngine` retorna ação determinística por aluno; pronta para ser plugada em qualquer botão dentro do drawer/risk list.

## Governança
- `QuickInterventionDialog` já cria `teacher_study_assignment` real através da action existente.
- `governance_logs` permite INSERT por qualquer authenticated; podemos plugar log dedicado num próximo loop sem alterar schema.
- `assistant_decisions` continua intocado e é a fonte primária da timeline.

## Limitações honestas
- **Theta TRI** real não foi calculado (sem pipeline TRI dedicado por turma). Usamos `theta_proxy` claramente nomeado.
- **Outcome pós-intervenção** ainda não está unificado — depende de `governance_logs.target_user_id`. Avisado no rodapé da timeline.
- **trend_7d** retorna `null` até o backend calcular janela 7d com snapshots.
- `governance_logs` SELECT só roda como admin; por isso a timeline usa `assistant_decisions` (acessível server-side) como fonte primária para professores.

## O que ficou fora desta entrega (próximos passos)
- `StudentOperationalDrawer` v2 com cards de FSRS/burnout dentro do drawer (estrutura já preparada via `student_cognitive_risks`).
- `QuickInterventionDialog` v2 multi-tipo (revisão FSRS / reduzir carga / monitorar).
- `governance_logs` write padronizado (módulo `professor_command_center`) com requestId/event_hash.
- Suite e2e `tests/e2e/professor-command-center.spec.ts`.
- Cálculo real de trend_7d via snapshots diários da turma.

## Respostas obrigatórias

| Pergunta | Resposta |
|---|---|
| Professor age em <30s? | Sim — abre em Operacional → Risco com KPIs reais e ações 1-clique. |
| Painel é enterprise? | Sim — 5 grupos, sub-abas, KPIs reais, matriz, timeline, ranking adulto. |
| Há mock? | Não. |
| Há KPI fake? | Não. KPI cognitivo só renderiza com valor não-null. |
| Dado insuficiente é tratado honestamente? | Sim — `DadosInsuficientesCard` em todos os widgets sem dado. |
| Há risco de overload? | Não. Lazy + sub-abas + dedupe via `useClassAnalytics`. |
| A matriz é útil? | Sim — 5 métricas cognitivas reais por especialidade com severity e sample_size. |
| Timeline é auditável? | Sim — IDs + timestamp + fonte + justificativa por evento. |
| Mobile funciona (430px)? | Sim — tabs em chips, matriz vira cards, drawer fullscreen, KPIs em grid 2-col. |
