# Professor Command Center — Relatório de Consolidação

Data: 2026-05-10
Escopo: Fase 1 (Consolidação) + Fase 2 (Alunos em Risco) + Fase 3 (Heatmap) + Fase 5 (UX Enterprise) + Fase 6 (Ações diretas) + Fase 7 (Mobile).

## O que mudou

### Antes
- 12 abas horizontais soltas (Simulados · Plantão · Video · Temas · Aluno · Turmas · Turma BI · BI · Mentoria · OSCE · Proficiência · Auditoria).
- Default em "Simulados" — primeira coisa que o professor via era uma lista de provas, não risco.
- Sem painel "Alunos em risco hoje" priorizado.
- Sem heatmap coletivo de especialidades.
- Sem ações diretas a partir de insight.

### Depois
- **5 grupos operacionais** com sub-abas por contexto:
  | Grupo | Sub-abas | Componentes existentes preservados |
  |---|---|---|
  | **Operacional** *(default)* | Alunos em risco · Heatmap turma · Aluno individual · Casos plantão | StudentTracker, ProfessorPlantao |
  | **Turmas** | Minhas turmas · BI da turma · BI agregada · Vídeo | ProfessorTurmaManager, ClassAnalytics, ProfessorBIPanel, VideoRoom |
  | **Simulados** | Simulados · OSCE | SimuladoListItem, SimuladosKpiCards, ProfessorPracticalExams |
  | **Mentoria** | Temas e atribuições · Planos · Proficiência | TeacherStudyAssignments, MentorThemePlans, ProfessorProficiencyPlans |
  | **Auditoria** | Trace e logs | ProfessorTraceAudit |
- **Default agora é Operacional → Alunos em risco**: o professor abre o painel e vê quem precisa de intervenção HOJE.
- 12 → 5 abas principais. Funcionalidades originais 100% preservadas como sub-abas.

## Novos componentes

### `src/components/professor/TopRiskStudents.tsx`
- Consome `class_analytics` (action existente) → `atRiskStudents`.
- Ordenação: critical primeiro · menor score · maior dias inativos.
- Badge crítico (rose) / atenção (amber) com contadores.
- Cada linha: nome · motivo · score · streak · dias inativos · questões respondidas.
- **Ações diretas (reais, não fake)**:
  - `Atribuir tarefa` → navega para Mentoria → Temas e atribuições
  - `Mentoria` → navega para Mentoria → Temas
  - `Detalhes` → abre Aluno individual (StudentTracker)
- Sem dado real → `<DadosInsuficientesCard />` honesto.

### `src/components/professor/ClassCognitiveHeatmap.tsx`
- Consome `class_analytics.specialtyBreakdown`.
- Grid responsivo: 2 cols (mobile) → 5 cols (desktop).
- Faixas de cor: <40 crítico · 40-59 fraco · 60-74 OK · 75-89 bom · 90+ forte.
- Legenda inline.
- Sem dado real → `<DadosInsuficientesCard />`.

## Princípios aplicados
- ✅ Verdade dos dados: zero mocks. Sem dado, fallback honesto.
- ✅ Backend intocado: usa `class_analytics` existente. Nenhuma edge function nova.
- ✅ Sem perda de função: as 12 telas continuam acessíveis.
- ✅ UX enterprise: sem glow excessivo, densidade alta, hierarquia clara.
- ✅ Mobile: 5 abas principais empilham 2/linha em 430px; sub-abas viram chips com wrap.
- ✅ Ações diretas: cada insight tem botão que leva para a tela de execução.

## O que NÃO foi tocado
- FSRS · TRI · prompts IA · modelos
- Schema do banco
- Edge function `professor-simulado` (apenas consumida)
- Rotas (`/dashboard/professor/...`)
- Componentes existentes ClassAnalytics/ProfessorBIPanel (mantidos como sub-abas)

## Pendências para próximas iterações (não bloqueantes)
- **Fase 4 KPIs adicionais**: theta médio turma, estabilidade FSRS média, retenção média, evolução 7d/30d → exigem novos campos no `class_analytics` (backend). Atual já cobre score/streak/dias inativos/questões.
- **Acionar "Atribuir Recovery direto"**: hoje navega para Temas; uma versão profunda criaria `study_assignment` em 1 clique a partir do TopRiskStudents.
- **Heatmap 2D** (especialidade × dificuldade ou × theta): atual é 1D por score; o backend precisaria expor breakdown por dificuldade.
- Migrar consumers do `ProfessorBIPanel` para o novo Command Center conforme a turma adotar.

## Validação rápida
- ✅ Sem erros de tipo
- ✅ Defaults: abre em Operacional → Alunos em risco
- ✅ Cada grupo tem sub-aba inicial garantida
- ✅ Ações de TopRiskStudents trocam grupo+sub-aba corretamente
