# Professor Command Center — Fechamento Operacional

Data: 2026-05-10

## O que mudou

### Backend
- Nova action `assign_intervention` em `professor-simulado` (universal):
  - tipos: `recovery | fsrs_review | adaptive_simulado | reduce_load | mentoria | monitor`
  - sempre grava em `governance_logs` (actor=professor, action_type=`professor.intervention.<type>`, severity, details com request_id, target_user_id, payload, side_effect)
  - sempre tenta `assistant_decisions` (decision_type=`professor_intervention_<type>`) como fallback de auditoria por aluno
  - side-effects best-effort: `recovery` cria `teacher_study_assignment`+result; `mentoria` envia `admin_messages`
  - **nunca quebra UI**: cada bloco de log/side-effect tem try/catch isolado; resposta sempre inclui `request_id`

### Frontend
- **`QuickInterventionDialog` v2**: prop `interventionType` aceita os 6 tipos; gera `request_id` UUID por intervenção; mostra severity + req_id na UI; chama nova action.
- **`StudentOperationalDrawer` v2**:
  - Recebe `risk: StudentCognitiveRisk` (vem de `class_analytics.student_cognitive_risks`)
  - Header com badge `Risco N · level`
  - Seção "Risco cognitivo" com 8 KPIs reais (risco, burnout, sobrecarga, inativo, FSRS stab/lapses, retenção, θ proxy)
  - Card "Ação recomendada" via `computeProfessorAction` (determinístico, sem LLM)
  - Barra com **6 botões reais** (recovery / FSRS / simulado adaptativo / reduzir carga / mentoria / monitorar) — botão sugerido recebe `ring-2`
  - Timeline distingue intervenções `Professor` (amber) das decisões `IA` (primary)
- **`ProfessorDashboard`** wiring:
  - Estado `intervention` substitui o antigo `recoveryFor` para suportar todos os tipos
  - Drawer recebe `risk` direto do `class_analytics`
  - `onAction` mapeia tipo → abre `QuickInterventionDialog` com sugestões pré-preenchidas

### Governance write
Toda intervenção produz registro com:
- `actor_user_id` (admin_id no governance_logs)
- `target_user_id` (no details + assistant_decisions.user_id)
- `action_type` (`professor.intervention.<type>`)
- `severity`
- `justification`
- `request_id` (UUID, idempotência futura)
- `metadata` (payload + side_effect + source_module)

### E2E
`tests/e2e/professor-command-center.spec.ts`:
- abre painel sem ErrorBoundary
- navega sub-abas operacionais (Matriz/Heatmap/Timeline/Ranking) sem crash
- viewport 430px sem overflow horizontal

## Princípios mantidos
- Zero mocks; sem dado → `DadosInsuficientesCard`
- Sem alterar schema do banco (usa `governance_logs` e `assistant_decisions` existentes)
- Sem novas edge functions; só nova action no `professor-simulado`
- RLS preservado: `governance_logs` permite insert authenticated; `assistant_decisions` é gravado via service_role no edge

## Pendências futuras (não bloqueantes)
- Endpoint `intervention_timeline` já existe — UI consolidada poderia agregar o request_id por aluno na timeline
- Idempotência por `request_id` (hoje gera, mas governance não tem unique constraint nele)
- `reduce_load` ainda é só log; falta integração concreta com planner para reduzir carga de fato
- `adaptive_simulado` poderia disparar `generate-adaptive-simulado` automaticamente
