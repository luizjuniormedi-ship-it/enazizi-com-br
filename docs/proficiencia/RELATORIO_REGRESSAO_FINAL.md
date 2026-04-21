# Relatório Final — Suíte de Regressão da Proficiência Guiada

**Data:** 2026-04-21  
**Status:** ✅ **52/52 testes passando** — pronto para piloto real

---

## 1. Resumo Executivo

| Camada | Arquivos | Testes | Status |
|---|---|---|---|
| **Unit** | 2 | 35 | ✅ 100% |
| **Integration** | 4 | 17 | ✅ 100% |
| **E2E (smoke)** | 1 | — | 🟡 criado, requer Playwright runner |
| **TOTAL automatizado** | 7 | **52** | ✅ |

Tempo de execução total: **~6.7s** (sem rede, sem DB real).

---

## 2. Correção aplicada nesta rodada

**Problema:** os 4 testes de integração falhavam com `MODULE_NOT_FOUND`.

**Causa raiz:** `vi.hoisted(() => require("../__mocks__/..."))` não passa pelo
resolver do Vite — nem caminho relativo, nem alias `@/` funcionam dentro de
`require()` em modo ESM.

**Categoria do bug:** problema de **infraestrutura de teste** (mock loader),
não do código produtivo. Nenhum hook ou edge function foi tocado.

**Correção cirúrgica:**
- Criado `src/test/__mocks__/supabaseMockSingleton.ts` que instancia o mock
  uma única vez como módulo ESM normal.
- `vi.mock` agora usa factory `async` com `await import(...)`, que **passa**
  pelo resolver do Vite e respeita o alias `@/`.
- Os 4 arquivos de integração foram ajustados (12 linhas alteradas no total).

Nenhuma regra de negócio, nenhum hook, nenhuma edge function foi modificada.

---

## 3. Cobertura por fluxo

### 3.1 Unit (35 testes)

**`planner.unit.test.ts`** — lógica determinística de `proficiency-planner`:
- 3 perfis de intensidade (`leve`/`moderado`/`intenso`) com dias úteis crescentes
- `buildStudyDates`: respeita folgas semanais corretamente para cada intensidade
- Não gera datas após `exam_date` (limite superior inclusivo)
- Lista vazia quando `exam < start`
- `SOURCE_MAP`: cobertura completa (`manual`/`auto`/`missed_goal`/`teacher_update`)
- `defaultReasonText`: cobre os 4 motivos de replan
- `computeProgressCounts`: completed/pending/overdue corretos
- `computeWeeklyGoalStatus`: thresholds done ≥100%, partial ≥50%, missed <50%
- `isInactive`: 3 dias / null / data inválida (fail-safe)
- Utilitários `isoDate` e `addDays` (imutabilidade)

**`csvExport.unit.test.ts`** — exportador CSV:
- Headers contém `turma` e `inativo`
- Ordem das colunas estável
- `escapeCsvField`: vírgula, aspas, quebra de linha, null/undefined
- Aluno `direct` → "Direto"; aluno `class` → nome real da turma
- Inativo marcado como `sim`/`nao`
- Vírgulas em nomes não quebram o layout
- BOM UTF-8 prefixado em `buildPlanCsvWithBom`

### 3.2 Integration (17 testes)

**`useStudentActivePlan.integration.test.ts` (5 testes)** — detecção do plano:
- Fallback preservado quando aluno não é alvo
- Detecção por alvo direto
- Detecção por `class_members`
- Status ≠ active não retorna
- `daysUntilExam` calculado corretamente

**`usePlansAnalyticsBatch.integration.test.ts` (4 testes)** — performance:
- Mapa vazio quando não há alunos
- Agrega `lateCount`/`missedGoalCount`/`inactiveCount`/`totalRecalcs` por plano
- Aluno sem registro de progresso é tratado como inativo
- Hook desabilitado quando lista vazia (não dispara query)

**`useProficiencyAnalytics.integration.test.ts` (2 testes)** — BI:
- `avgProgress`/`onTrackCount`/`lateCount`/`inactiveCount` corretos
- `missedGoalRecalcs` × `teacherUpdateRecalcs` separados
- `class_label` populado para alunos via turma
- Plano sem alunos: summary zerado

**`replan.integration.test.ts` (6 testes)** — fluxos críticos:
- `useCreateProfessorPlan`: insere plano + targets (user e class) + subtopics na ordem correta
- `useAddPlanSubtopics`: dispara `teacher_update` para cada aluno alvo
- `useAddPlanSubtopics`: não duplica subtemas existentes
- `useRecalcProficiencyProgress`: invoca `proficiency-progress-recalc` com `planId`
- `useGenerateProficiencyPlan`: invoca `proficiency-planner` com `planId` e propaga retorno
- `useGenerateProficiencyPlan`: propaga erro da edge function

### 3.3 E2E (`tests/e2e/proficiencia.spec.ts`)

Smoke criado para Playwright cobrindo:
- Aluno sem plano vê fallback de `/dashboard/proficiencia`
- Professor abre dialog de criação de plano

> ⚠️ Requer ambiente Playwright separado (`npx playwright test`). Não roda em CI Vitest.

---

## 4. Gaps remanescentes (não automatizados)

### Risco baixo — comportamento estável e simples
- **UI components puros** (`PlanRiskBadges`, `StudentTasksDialog`, `PlanAnalyticsDialog`):
  os hooks que alimentam esses componentes estão cobertos; a renderização em si
  é trivial e seria coberta por testes manuais.
- **Realtime / subscriptions** (`postgres_changes`): não usado neste módulo.

### Risco médio — vale validação manual
- **Dedupe da edge `proficiency-planner`** por `(planned_date, task_type, subtopic_id)`:
  a lógica de `_shared.ts` está testada, mas a interação completa dentro da edge
  function (com Deno + service_role) não roda no Vitest. **Recomendado: smoke manual.**
- **Cooldown de 24h em `missed_goal`** dentro de `proficiency-progress-recalc`:
  mesma situação — lógica testada de forma isolada, mas o caminho completo
  (gravação em `professor_plan_recalculations` + cooldown lookup) requer DB real.
- **RLS efetiva**: `professor_owns_plan` e `user_is_target_of_plan` validados
  por leitura (auditoria anterior), mas não exercitados por tentativa de acesso
  cross-user automatizada.

### Risco alto — exige piloto real
- **Geração automática de tarefas no primeiro acesso do aluno** (`triggeredRef`
  anti-loop em `ProficiencyGuidedPanel`): só pode ser validado com login real
  em ambiente preview.
- **Notificações in-app** disparadas para professor quando aluno fica inativo
  ou perde meta — não há suíte automatizada.

---

## 5. Checklist manual final (smoke de 30 min)

Sugerido executar antes de liberar piloto, com **1 conta professor + 2 alunos**:

### Fluxo do professor
- [ ] Criar plano individual com 3 subtemas e `exam_date` 30 dias à frente
- [ ] Criar plano por turma (1 turma com 2 alunos ativos)
- [ ] Pausar e retomar o plano
- [ ] Adicionar 1 subtema novo → confirmar que `teacher_update` aparece em `professor_plan_recalculations`
- [ ] Abrir BI: confirmar contadores (`avgProgress`, `inactiveCount`, `lateCount`)
- [ ] Exportar CSV: abrir no Excel/LibreOffice e confirmar:
  - acentos corretos (BOM)
  - coluna `turma` preenchida com nome real
  - coluna `inativo` com `sim`/`nao`
- [ ] Drill-down de tarefas por aluno: ver origem (`Planner` / `Replanejamento por atraso` / `Replanejamento por atualização do professor`)

### Fluxo do aluno
- [ ] Aluno com plano ativo entra em `/dashboard/proficiencia` → painel guiado aparece
- [ ] Tarefas geradas automaticamente no primeiro acesso (sem loop)
- [ ] Concluir 1 tarefa → progresso atualiza
- [ ] Pular 1 tarefa → status correto
- [ ] Forçar atraso (deixar 1 dia sem mexer + meta semanal abaixo de 50%) → confirmar `missed_goal` registrado
- [ ] Aluno sem plano: fluxo `/dashboard/proficiencia` continua mostrando experiência antiga (fallback)

### Não regressão
- [ ] `StudentSimulados` continua abrindo
- [ ] `ProfessorDashboard` continua funcional
- [ ] Jornada normal de estudo (sessão, FSRS, mnemônicos) intocada

---

## 6. Parecer final

| Critério | Avaliação |
|---|---|
| Cobertura de regras determinísticas | ✅ Excelente |
| Cobertura de hooks críticos (planner, replan, BI) | ✅ Boa |
| Cobertura de UI | 🟡 Parcial (depende de smoke manual) |
| Cobertura E2E | 🟡 Smoke pronto, requer execução |
| Risco de regressão silenciosa em deploy | 🟢 Baixo |
| Risco operacional residual | 🟢 Baixo, controlado pelo checklist manual |

**Veredito:** **Pronto para piloto real**, condicionado à execução do checklist
manual de 30 minutos antes do go-live. A suíte automatizada protege as Fases 1–6
contra regressões silenciosas; o checklist cobre os caminhos que dependem de
backend real (Deno edge + RLS + UI).

---

## 7. Próximos incrementos recomendados (pós-piloto)

1. **Tests E2E Playwright reais** rodando em CI com seed de DB de teste.
2. **Cobertura visual** (Storybook + Chromatic) para `PlanAnalyticsDialog` e
   `PlanRiskBadges`.
3. **Teste de carga** do `usePlansAnalyticsBatch` com 50+ planos simultâneos.
4. **Mutation testing** (Stryker) sobre `_shared.ts` do planner para garantir
   que os 35 unit tests realmente protegem a lógica.
