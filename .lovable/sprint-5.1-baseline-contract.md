# Sprint 5.1 — Contrato da Baseline Comportamental

**Data:** 2026-04-23
**Status:** ⏳ aguardando volume mínimo de dados
**Filosofia:** baseline nasce de comportamento real, não de pressa.

> 📐 **Definição oficial de "ação pedagógica real"** (o que conta como `first_meaningful_action`):
> ver [`sprint-5.1-meaningful-action-definition.md`](./sprint-5.1-meaningful-action-definition.md).
> Resumo: conta apenas **entrada em estado ativo de aprendizagem** — discovery (ENAFLIX browsing, abrir IA sem pergunta de estudo, navegação) **não conta**.

---

## Por que essa página existe

Você pediu a **primeira leitura real**. Ao consultar a base agora encontrei:

| Indicador | Valor atual |
|---|---|
| Eventos totais | 2 |
| Usuários únicos | 1 |
| `session_start` | 2 |
| `first_meaningful_action` | **0** |
| `study_action_started` | 0 |
| Tempo coletado | ~9 minutos |

Forçar uma classificação 🟢🟡🔴 em cima disso seria criar um **ponto de comparação falso** — exatamente o oposto do que a Sprint 5 quer ser.

Então essa página congela **o contrato**: quando a baseline pode ser publicada, com que critérios, e como ela será classificada.

---

## Critérios para considerar a baseline VÁLIDA

A baseline só pode ser declarada oficial quando TODAS as condições abaixo forem verdadeiras:

| Critério | Threshold mínimo | Por quê |
|---|---|---|
| **Janela de coleta** | ≥ 7 dias corridos | cobre variação dia-de-semana vs fim-de-semana |
| **Sessions únicas** | ≥ 100 | reduz ruído estatístico em médias e p95 |
| **Usuários distintos** | ≥ 10 | evita viés de 1-2 power users |
| **`first_meaningful_action`** | ≥ 30 | habilita análise de tempo-até-ação |
| **Mobile + Desktop ambos > 0** | sim | permite comparação por viewport |
| **Sem mudança em UI/rotas** | sim | causalidade preservada |

Se qualquer critério falhar → baseline **não é publicada**, esperamos mais dados.

---

## Métricas que serão classificadas

Cada métrica abaixo terá faixa 🟢/🟡/🔴 fixa, definida ANTES de ver os dados (para evitar viés de confirmação).

### A. Tempo-até-ação (mediana, em segundos)
| 🟢 saudável | 🟡 atenção | 🔴 crítico |
|---|---|---|
| < 30s | 30-90s | > 90s |

### B. Tempo-até-ação (p95, em segundos)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| < 120s | 120-300s | > 300s |

### C. Cliques antes da ação (média)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| < 3 | 3-7 | > 7 |

### D. Trocas de rota antes da ação (média)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| < 2 | 2-4 | ≥ 5 |

### E. Taxa de abandono (% de session_start sem ação em 30min)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| < 15% | 15-30% | > 30% |

### F. % de sessions com ≥4 trocas de rota (loops)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| < 5% | 5-15% | > 15% |

### G. Mobile vs Desktop (delta de mediana)
| 🟢 | 🟡 | 🔴 |
|---|---|---|
| mobile ≤ desktop +30% | +30% a +80% | > +80% |

---

## Distribuição esperada de entry_points

A baseline vai descrever (sem julgar) como os 4 pontos de entrada são usados:

- 🏠 `visao_geral`
- 🧠 `estudar`
- 🎬 `enaflix`
- 🤖 `ia`
- ⋯ `other` / `bottom_nav` / `sidebar` / `mission_resume`

Hipótese de saúde (NÃO usada para classificar — só para discussão futura):
- `estudar` deve ter **menor mediana** de tempo-até-ação
- `enaflix` pode ter mediana alta (discovery ≠ execução) **sem ser problema**
- `visao_geral` deve ser intermediário

---

## Script SQL oficial da baseline

Salvo em `.lovable/sprint-5.1-baseline-queries.sql`.
Esse script é **read-only**, idempotente e produz exatamente as 7 seções classificáveis acima.

Quando o volume mínimo chegar:

1. Rodar o script.
2. Preencher esta página com os números reais.
3. Aplicar 🟢🟡🔴 conforme as faixas fixas acima.
4. Congelar a versão como "baseline oficial v1".

---

## O que fica REGISTRADO sem ainda ser baseline

| Item | Valor em 2026-04-23 18:53 UTC |
|---|---|
| Sprint 4 (telemetria) ativa desde | 2026-04-23 ~18:40 UTC |
| Total de eventos | 2 |
| Total de usuários | 1 |
| Status da baseline | ⏳ aguardando volume |

---

## O que NÃO fazemos enquanto espera

- ❌ Não classificar nada com n<30
- ❌ Não usar dados de teste interno como baseline real
- ❌ Não mexer em UI / navegação / IA / motion
- ❌ Não criar dashboard visual (queries SQL bastam)
- ❌ Não inferir "tendências" de poucas horas de dados

## O que fazemos quando os critérios baterem

1. Rodar `sprint-5.1-baseline-queries.sql`.
2. Atualizar este documento com a tabela final.
3. Marcar status: ✅ baseline oficial v1.
4. **Só depois disso** considerar refino de UI cirúrgico (Sprint 6).

---

## Resumo em uma linha

> A baseline ainda não existe. O contrato dela existe. Quando os dados chegarem, ela vira fato — não opinião.
