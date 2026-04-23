# Sprint 5 — Análise de Hesitação Cognitiva

**Data:** 2026-04-23
**Escopo:** Construir o aparato analítico que transforma a telemetria da Sprint 4 em **detecção de gargalos reais**.
**Filosofia:** observar comportamento, não decorar dashboard.

---

## Por que essa sprint não é "mais uma feature"

A Sprint 4 deixou a telemetria rodando, mas dados crus não respondem perguntas. A Sprint 5 entrega a **camada de leitura cognitiva** — 5 views SQL que transformam eventos em sinais comportamentais.

Quando o volume de dados subir (≥7 dias, ≥30 sessions/dia), essas views já estarão prontas para responder, sem precisar refazer query nenhuma:

> Onde o aluno trava? Onde pensa demais? Onde o produto compete consigo mesmo?

---

## O que foi entregue

### 5 views administrativas (read-only, security_invoker)

| View | Pergunta que responde |
|---|---|
| `v_hesitation_by_route` | Que **rota inicial** gera mais demora até o aluno agir? |
| `v_hesitation_by_entry_point` | **Visão Geral / Estudar / ENAFLIX / IA** — qual é mais eficiente? |
| `v_abandoned_sessions` | Quem **abriu o app mas saiu sem estudar** (em até 30 min)? |
| `v_navigation_loops` | Quem fez **4+ trocas de rota** antes da primeira ação? (indecisão) |
| `v_route_efficiency_ranking` | Ranking de **fricção composta** (tempo + cliques×2 + rotas×5) |

### Acesso

- **Aluno:** continua vendo apenas seus próprios eventos.
- **Admin:** nova policy `"Admins can read all telemetry"` libera leitura agregada.
- **Helper TS:** `src/lib/hesitationAnalytics.ts` — funções tipadas para leitura admin (uso futuro em console interno).

### Zero impacto no aluno

- ❌ Sem nova UI
- ❌ Sem nova rota
- ❌ Sem mudança em Visão Geral / Estudar / ENAFLIX
- ❌ Sem mudança no cockpit operacional
- ❌ Sem novo motion ou widget

---

## Sinais comportamentais que estamos detectando

| Sinal | Como detectar | View |
|---|---|---|
| **Tempo-até-ação alto** | `ms_since_session_start > 60s` na mediana | `v_hesitation_by_route` |
| **Cliques desnecessários** | `avg_clicks_before > 5` | `v_hesitation_by_entry_point` |
| **Loop de navegação** | `pre_action_route_changes >= 4` | `v_navigation_loops` |
| **Abandono** | `session_start` sem `first_meaningful_action` em 30 min | `v_abandoned_sessions` |
| **Rota confusa** | `friction_score` alto no ranking | `v_route_efficiency_ranking` |

### Fórmula de fricção

```
friction_score = avg_seconds + (avg_clicks × 2) + (avg_route_changes × 5)
```

A ponderação reflete a hipótese da Sprint 3: **cada troca de rota custa mais energia mental que um clique, que custa mais que tempo passivo**.

---

## Queries-chave (rodar como admin)

### 1. Hipótese A — Estudar é o ponto mais eficiente?

```sql
SELECT entry_point, viewport, sessions, median_seconds_to_action, avg_clicks_before
FROM v_hesitation_by_entry_point
ORDER BY median_seconds_to_action ASC;
```

**Esperado:** `entry_point = 'estudar'` no topo (menor mediana).
**Se NÃO:** o aluno está achando ação real fora do hub Estudar — investigar.

### 2. Hipótese B — ENAFLIX é exploração, não execução?

```sql
SELECT
  entry_point,
  COUNT(*) FILTER (WHERE event_type='session_start')        AS starts,
  COUNT(*) FILTER (WHERE event_type='first_meaningful_action') AS actions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type='first_meaningful_action')
                    / NULLIF(COUNT(*) FILTER (WHERE event_type='session_start'), 0), 1) AS conversion_pct
FROM behavioral_telemetry
WHERE created_at >= now() - INTERVAL '7 days'
GROUP BY entry_point;
```

**Esperado:** ENAFLIX com conversão menor que Estudar (é o papel dele).
**Se ENAFLIX > Estudar:** o produto está confundindo discovery com execução.

### 3. Hipótese D — CTA dominante mobile reduziu hesitação?

```sql
SELECT viewport,
       ROUND(AVG(median_seconds_to_action), 1) AS median_seconds,
       ROUND(AVG(avg_clicks_before), 2)        AS avg_clicks,
       SUM(sessions)                            AS sessions
FROM v_hesitation_by_route
GROUP BY viewport;
```

**Esperado:** mobile com mediana ≤ desktop + 30%.
**Se mobile >> desktop:** Sprint 3 não foi suficiente.

### 4. Top 5 rotas mais lentas (gargalos)

```sql
SELECT route, entry_point, sessions, median_seconds, avg_clicks, friction_score
FROM v_route_efficiency_ranking
WHERE sessions >= 5
ORDER BY friction_score DESC
LIMIT 5;
```

**Use para:** identificar qual rota merece refinamento na próxima sprint cognitiva.

### 5. Taxa de abandono por viewport

```sql
SELECT viewport, COUNT(*) AS abandoned, day
FROM v_abandoned_sessions
WHERE day >= current_date - 7
GROUP BY viewport, day
ORDER BY day DESC, abandoned DESC;
```

**Esperado:** abandono baixo e estável.
**Pico repentino:** algo quebrou a percepção de "o que fazer agora".

### 6. Loops de indecisão recentes

```sql
SELECT user_id, final_route, pre_action_route_changes, pre_action_clicks, seconds_to_action
FROM v_navigation_loops
ORDER BY created_at DESC
LIMIT 20;
```

**Use para:** ver casos concretos onde o aluno "vagou" antes de agir.

---

## Estado atual dos dados

A telemetria está ativa há **menos de 1 dia**. Nesta sprint só **construímos o instrumental**. As respostas reais virão depois de ≥7 dias com volume mínimo de:

- 30 sessions/dia
- ≥10 first_meaningful_action/dia

---

## Threshold de "saudável" vs "preocupante"

| Métrica | Saudável | Atenção | Crítico |
|---|---|---|---|
| Mediana tempo-até-ação | < 30s | 30-90s | > 90s |
| Cliques antes da ação | < 3 | 3-7 | > 7 |
| Trocas de rota antes da ação | < 2 | 2-4 | ≥ 5 |
| Taxa de abandono | < 15% | 15-30% | > 30% |
| % sessions com ≥4 route changes | < 5% | 5-15% | > 15% |

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/...sprint5_hesitation_views...` | 5 views + 1 policy admin |
| `src/lib/hesitationAnalytics.ts` | helper TS read-only (admin) |
| `.lovable/sprint-5-hesitation-analysis.md` | este documento |

**Zero rotas mudadas. Zero componentes novos visíveis. Zero alteração em ENAFLIX, Visão Geral, Estudar ou cockpit.**

---

## O que NÃO foi feito (intencional)

- ❌ Sem painel visual de métricas
- ❌ Sem alerta automático de fricção
- ❌ Sem novo evento de telemetria (Sprint 4 já basta)
- ❌ Sem mudança em UI do aluno
- ❌ Sem decisão prematura sobre "qual rota refatorar"

A regra da fase de hardening: **medir antes de mexer**.

---

## Próxima sprint sugerida (rodar APÓS 7 dias de dados)

**Sprint 6 — Primeira Análise Cognitiva Real:**
1. Rodar as 6 queries acima.
2. Identificar **1 (uma)** rota com `friction_score` mais alto.
3. Refinar **somente essa rota** com mudança cirúrgica de UX.
4. Esperar 7 dias e medir novamente.

Ciclo: **medir → refinar 1 ponto → medir de novo**. Sem bombardeio de mudanças.
