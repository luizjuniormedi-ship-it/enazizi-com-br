# Auditoria BI — Professor
Gerado: 2026-05-10

## 1. Estrutura geral
- Rota: `/dashboard/professor` (não há rota `/professor` separada — fica embutida no layout do aluno)
- 12 abas no mesmo painel: `simulados | plantao | video | temas | alunos | turmas | analytics | bi | mentoria | osce | proficiencia | auditoria`
- Toda comunicação via edge function única `professor-simulado` com `action: ...`

## 2. Capacidade de ação
Para cada aba, "o professor consegue agir (intervir, atribuir, mensagem)?"

| Aba | Ação prática | Decisão clara? |
|---|---|---|
| Simulados | criar/editar/atribuir/ver resultados | ✅ |
| Plantão | criar casos, atribuir | ✅ |
| Video | criar sala Meet, convidar alunos | ✅ |
| Temas | atribuir tema/subtema a aluno/turma | ✅ |
| Alunos (StudentTracker) | ver perfil, histórico | ⚠️ falta CTA "intervir" |
| Turmas | CRUD turmas | ✅ |
| Turma BI (ClassAnalytics) | ver médias, distribuições | ⚠️ **insight sem ação** |
| BI (ProfessorBIPanel) | dashboards de turma | ⚠️ **🔁 sobrepõe com Turma BI** |
| Mentoria | criar planos por tema | ✅ |
| OSCE | provas práticas | ✅ |
| Proficiência | criar/editar planos | ✅ |
| Auditoria | trace de decisões IA | ✅ (mas para casos específicos) |

## 3. Detecção de risco
- Identificação de **aluno em risco**: existe `risk_score`/`engagement_score` na memória, mas nenhuma aba do professor expõe um **"Top alunos em risco hoje"** acionável (lista priorizada com botão "intervir").
- Não há painel de **abandono / drop-off** com 1 clique.
- **Burnout / overload** não tem visibilidade no painel professor.
- **Heatmap da turma** (dias × atividade): existe `ActivityHeatmap` para o aluno, mas não há versão coletiva agregada por turma.

## 4. KPIs duplicados / redundantes
- `ClassAnalytics` (tab `analytics`) e `ProfessorBIPanel` (tab `bi`) — dois painéis com nomes diferentes para a mesma intenção. Provavelmente um é evolução do outro e o legado ficou.
- `SimuladosKpiCards` em cima da lista de simulados — `totalSimulados`, `totalStudentsAssigned`, `totalCompleted`. Bom, mas não há **taxa média de acerto da turma** no topo.
- `MentorshipReport` separado — possivelmente sobrepõe com BI.

## 5. Overload visual
- 12 tabs com emoji + label + tudo em CAPS LOCK + classes pesadas (`font-black uppercase tracking-wider`) — cansa em sessões longas.
- Em mobile (430px), as 12 tabs viram grid 2-col com `min-w-[48%]` — gera **6 linhas** de tabs antes do conteúdo.
- Sugestão: agrupar em 4 grupos (`Conteúdo`, `Alunos`, `BI`, `Operação`) com sub-tabs.

## 6. Rankings/gamificação no professor
- Não existe ranking de turmas, professores ou alunos próprios — provavelmente intencional (evita comparação). OK.

## 7. FSRS/TRI coletivo
- Não há agregação visível de FSRS médio da turma, % de revisões em dia, lapses coletivos.
- TRI também ausente em nível de turma — professor não vê dificuldade percebida pelos alunos nos itens.

## 8. Achados — prioridades

### ALTO
1. **Unificar `ClassAnalytics` + `ProfessorBIPanel`** em uma aba "Inteligência da Turma".
2. Adicionar painel **"Alunos em risco hoje"** (top 10) com CTA `intervir` que cria mensagem/atribuição em 1 clique.
3. Adicionar **heatmap coletivo da turma** + **taxa média de acerto** ao topo.
4. Reduzir tabs: agrupar 12 → 5 grupos.

### MÉDIO
5. Expor FSRS/TRI agregado da turma (média de cards atrasados, theta médio por tema).
6. CTA "intervir" em StudentTracker.
7. Reduzir CAPS LOCK e peso tipográfico para reduzir fadiga.

### BAIXO
8. Auditoria: link cruzado a partir de qualquer card de erro do aluno.
