# ENAZIZI — Modo Observacional Congelado

**Data de entrada em vigor:** 2026-04-23
**Status:** 🧠 OBSERVACIONAL CONGELADO
**Autor da decisão:** usuário
**Validade:** até `baseline_status = READY` (ver `sprint-5.1-baseline-contract.md`)

---

## Declaração oficial

A fase de construção, refino e instrumentação do ENAZIZI está **encerrada**.
O sistema entra agora em **uso real observacional controlado**.

O foco deixa de ser construir e passa a ser **observar comportamento humano real sem interferência**.

---

## Arquitetura oficial congelada

| Módulo | Função |
|---|---|
| 🏠 Visão Geral | orientação |
| 🧠 Estudar | execução |
| 🎬 ENAFLIX | descoberta |
| 🤖 IA | suporte contextual |

Esta é a estrutura final. Não será alterada durante o período observacional.

---

## O que está PROIBIDO durante o congelamento

### Não alterar
- ❌ UI / UX / motion / visual
- ❌ Navegação (sidebar, bottom nav, rotas)
- ❌ Arquitetura de módulos
- ❌ Comportamento da IA / Tutor
- ❌ ENAFLIX (hub, catálogo, cards)
- ❌ OperationalHub / página Estudar
- ❌ Visão Geral / Dashboard
- ❌ Telemetria existente
- ❌ Thresholds / pesos / fórmulas
- ❌ Critérios da baseline

### Não implementar
- ❌ Novos trackers ou eventos
- ❌ Novos dashboards
- ❌ Novos gaps de instrumentação
- ❌ Redesigns parciais ou totais
- ❌ Experimentos A/B
- ❌ Otimizações preventivas / "por feeling"
- ❌ Correções antecipadas baseadas em ansiedade

---

## Definição oficial da baseline (reforço)

> `first_meaningful_action` = **entrada em estado ativo de aprendizagem**.

Não conta: discovery, exploração, navegação, curiosidade.
Conta apenas: **execução pedagógica ativa**.

Detalhes em `sprint-5.1-meaningful-action-definition.md`.

---

## Telemetria

A telemetria atual é considerada **suficiente para baseline v1**.

NÃO adicionar:
- scroll tracking
- hover tracking
- heatmaps
- tracking de atenção
- tracking genérico de cliques

---

## Gaps reconhecidos (mantidos não-instrumentados de propósito)

| Gap | Status |
|---|---|
| Tutor IA contextual | 📝 documentado, ❌ não instrumentar |
| ENAFLIX execução | 📝 documentado, ❌ não instrumentar |
| Banco de Erros revisão | 📝 documentado, ❌ não instrumentar |
| Continuação de sessão | 📝 documentado, ❌ não instrumentar |
| Mini-quiz Tutor | 📝 documentado, ❌ não instrumentar |

A ausência destes eventos é **metodologicamente correta** sob a definição atual.

---

## O que deve acontecer agora

### Coleta natural
- alunos reais usando em sessões reais
- mobile real + desktop real
- estudo real, cansaço real, procrastinação real, foco real

### Sem intervenção
- ❌ não corrigir preventivamente
- ❌ não otimizar por intuição
- ❌ não ajustar por ansiedade de produto
- ❌ não mudar comportamento do sistema

---

## Quando o congelamento pode ser quebrado

**Somente** quando TODOS forem verdade:

1. Critérios mínimos da baseline atingidos (ver `sprint-5.1-baseline-contract.md`):
   - ≥ 7 dias corridos de coleta
   - ≥ 100 sessions únicas
   - ≥ 10 usuários distintos
   - ≥ 30 `first_meaningful_action`
   - mobile + desktop ambos > 0
   - sem mudança em UI/rotas durante a janela
2. `sprint-5.1-baseline-queries.sql` rodado.
3. Baseline oficial v1 publicada com classificação 🟢🟡🔴.

---

## Ciclo oficial pós-baseline

1. Ler os dados.
2. Identificar **1 gargalo dominante**.
3. Fazer **1 ajuste cirúrgico**.
4. Esperar nova janela de coleta.
5. Comparar impacto antes/depois.

⚠️ Nunca múltiplas mudanças simultâneas — quebra a causalidade.

---

## Mudança de natureza do produto

| Antes | Agora |
|---|---|
| Produto guiado por opinião | ✅ Produto guiado por comportamento observável |
| Foco em parecer inteligente | ✅ Foco em entender como humanos realmente estudam |
| Construção contínua | ✅ Observação disciplinada |

---

## Resumo em uma linha

> O ENAZIZI parou de ser construído e começou a ser **escutado**.
