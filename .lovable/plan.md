
# Plano — Evolução do BI (Aluno + Professor)

Objetivo: transformar os painéis atuais (hoje muito densos, com métricas frias e alguns mocks) em **BI acionável**, com linguagem em pt-BR, tooltips explicativos, hierarquia clara e KPIs que realmente movem decisão pedagógica.

Sem mudar contratos do core (FSRS, Planner, Tutor) — apenas camada de apresentação + 2 RPCs novas de leitura.

---

## 1. Princípios

```text
1. Toda métrica responde a 3 perguntas:
   • O que é?         → label pt-BR
   • Como é calculada? → tooltip
   • O que eu faço?    → CTA contextual
2. Nada de número solto: sempre tendência (↑ ↓ →) + comparativo (vs 7d / vs turma).
3. Zero mocks. Se o dado não existe, mostrar estado vazio honesto ("ainda sem dados, responda X questões").
4. Mobile-first (430px): hero curto, KPIs em 2 colunas, scroll vertical natural.
```

---

## 2. BI do ALUNO — reorganização

### 2.1 Topo (acima da dobra, mobile)
Substituir hero cinemático de 500px por **Cockpit Resumido (180px)**:

```text
┌──────────────────────────────────────────┐
│ Olá, Luiz  •  Streak 12🔥  •  Nível 7    │
│ Prontidão ENARE: 62% ↑3   [Ver detalhes]│
│ Próxima ação: Revisar 8 cards de Cardio │
│ [▶ Começar agora]                        │
└──────────────────────────────────────────┘
```

### 2.2 Bloco "Minha Performance" (KPIs com tooltip)
| Card | Label pt-BR | Tooltip |
|---|---|---|
| Prontidão | "Índice de Prontidão" | "0–100. Combina acerto recente, cobertura curricular, FSRS e simulados." |
| Chance Aprovação | "Chance estimada — ENARE/ENAMED" | "Projeção bayesiana a partir do seu histórico vs aprovados anteriores." |
| Acerto 7d | "Acerto últimos 7 dias" | "Questões corretas / respondidas nos últimos 7 dias." |
| Retenção FSRS | "Retenção de memória" | "% de cards revisados no prazo com acerto." |
| Tempo médio/questão | "Ritmo" | "Segundos médios para responder. Comparado ao tempo de prova real." |
| Lapses | "Esquecimentos" | "Cards já dominados que voltaram a errar — sinal de revisão urgente." |

### 2.3 Bloco "Meus Temas" (substitui cards hardcoded)
- Top 3 **fortes** (verde, ≥80%) — "manter com revisão espaçada"
- Top 3 **fracos** (vermelho, <50%) — CTA "Treinar 10 questões"
- Top 3 **em evolução** (amarelo, delta ±8%) — "Continuar reforçando"

Fonte: `performance_by_topic` + `medical_domain_map` (fallback) + `user_topic_profiles`.

### 2.4 Bloco "Minha Trajetória"
- Gráfico semanal: acerto, tempo de estudo, revisões executadas (linhas sobrepostas)
- Marcadores de eventos: simulados, mudança de plano, recuperação ativada
- Tooltip por dia: "Terça 03/06: 47 questões, 71%, 38min"

### 2.5 Bloco "O que fazer agora" (CTAs reais, fim do dashboard)
Lista priorizada do `study-orchestrator`:
1. 🔴 8 cards FSRS atrasados (Cardiologia) → [Revisar]
2. 🟡 Simulado semanal pendente → [Iniciar]
3. 🟢 Mentoria do professor: "Sepse pediátrica" → [Estudar]

---

## 3. BI do PROFESSOR — reorganização

### 3.1 Topo: Saúde da Turma (1 linha)
```text
Turma A • 34 alunos • Prontidão média 58% ↑2 • 5 em risco 🔴 • 8 atenção 🟡
```

### 3.2 Bloco "Alunos por Status" (segmentação acionável)
Quatro colunas clicáveis:
| 🟢 Ativos (21) | 🟡 Atenção (8) | 🔴 Risco (4) | ⚫ Crítico (1) |

Clique abre lista filtrada com:
- Nome • Prontidão • Acerto 7d • Última atividade • **Motivo do status** • CTA "Enviar mentoria"

Tooltip no header: explica fórmula (risk_score, engagement_score).

### 3.3 Bloco "Heatmap Curricular da Turma"
Matriz Especialidade × Domínio:
- Verde: turma ≥75%
- Amarelo: 50–75%
- Vermelho: <50% **e** está no blueprint da prova alvo (peso alto destacado)

CTA por célula vermelha: "Criar simulado focado" / "Atribuir estudo".

### 3.4 Bloco "Intervenções e Impacto"
Tabela das últimas mentorias/simulados atribuídos:
| Intervenção | Alunos | Conclusão | Δ Acerto | Status |
|---|---|---|---|---|
| Simulado Cardio 03/06 | 28 | 22/28 | +9% | ✅ |
| Mentoria Sepse | 34 | 12/34 | — | 🟡 baixa adesão |

Mostra **impacto real** (antes/depois) — vincula ao Impact Engine já existente.

### 3.5 Bloco "Alertas Inteligentes" (top 5)
Substitui os 5 sistemas paralelos por um único feed priorizado:
- 🔴 João Silva: 0 atividade há 9 dias + 3 simulados não feitos
- 🟡 Maria: queda de 18% em Pediatria nas últimas 2 semanas
- 🟢 Pedro: subiu para tier "Pronto" — parabenizar

---

## 4. Padrão de tooltips (componente único)

Criar `<MetricCard>` com props:
```ts
{ label: string;          // pt-BR
  value: string|number;
  delta?: number;         // ↑↓→
  tooltip: string;        // "O que é + como é calculado"
  cta?: { label, onClick };
  emptyState?: string;    // quando data=null
}
```
Todos os cards do dashboard aluno e professor passam a usar esse componente — garante consistência e elimina divergências de label.

---

## 5. Backend / dados (mínimo necessário)

Apenas leitura, sem alterar schema crítico:

1. **RPC `get_student_bi_summary(p_user_id)`** — retorna em 1 chamada: KPIs, top temas, trajetória 14d, próximas ações. Hoje o dashboard faz 6–8 queries paralelas.
2. **RPC `get_class_bi_summary(p_turma_id)`** — agrega status, heatmap, intervenções com impacto.
3. **Job diário** já existente (`approval_scores`, `ranking_snapshots`) precisa ser **reativado** — sem isso 30%+ dos KPIs ficam zerados (constatado em `.lovable/bi-aluno-audit.md`).
4. Remover `Math.random()` em `Dashboard.tsx:289` e cards hardcoded 297–355.

---

## 6. Faseamento sugerido

```text
Fase 1 (2–3 dias) — Fundação
  • Componente <MetricCard> + tooltips pt-BR
  • Remoção de mocks
  • Reativar pipelines approval_scores / ranking_snapshots

Fase 2 (3–4 dias) — Aluno
  • Cockpit resumido + blocos 2.2 a 2.5
  • RPC get_student_bi_summary

Fase 3 (3–4 dias) — Professor
  • Status segmentado + heatmap curricular
  • Bloco de impacto de intervenções
  • Feed único de alertas (consolidar 5 sistemas)

Fase 4 (2 dias) — Mobile + polimento
  • Hero 500→180px, grids 2-col, scroll natural
  • QA visual em 430×667
```

---

## 7. Fora do escopo (intencional)

- Não mexe em FSRS, Tutor, Planner, Orchestrator (Go-Live Freeze).
- Não cria novas métricas psicométricas (Sprint 2.3 guard-rail).
- Não altera nomes de módulos/sidebar (constraint).
- Sem PDFs/planilhas — tudo no chat/UI conforme preferência.

---

## Perguntas antes de implementar

1. Começo pela **Fase 1 + Fase 2 (aluno)** ou prioriza **professor** primeiro?
2. Os 4 status (Ativo/Atenção/Risco/Crítico) seguem as fórmulas já existentes em `MonitoringTypes.ts` ou quer revisar os limiares?
3. Reativar os jobs `approval_scores` e `ranking_snapshots` faz parte deste plano ou já será tratado em paralelo?
