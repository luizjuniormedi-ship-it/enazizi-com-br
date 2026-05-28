# Ontology SLOs — Freeze v25

Metas operacionais oficiais. Violação sustentada → suspender expansão e abrir incidente.

## Métricas e targets

| Métrica                          | Target     | Fonte                                     |
| -------------------------------- | ---------- | ----------------------------------------- |
| Rollback time                    | < 2 min    | Cronometragem do drill mensal             |
| Drift unresolved                 | < 5%       | `ontology.v_semantic_drift` vs total      |
| Unregistered consumers           | 0          | `v_ontology_health.unregistered_access_groups` |
| Runtime incidents                | 0          | Postmortems oficiais                      |
| Semantic review SLA              | < 7 dias   | Tempo médio para resolver drift           |
| RFC review SLA                   | < 14 dias  | Tempo da abertura até decisão do Board    |
| Health snapshot frequency        | quinzenal  | Logs operacionais                         |
| Rollback drill frequency         | mensal     | Logs operacionais                         |

## Janelas de avaliação

- **Diária**: incidentes (0 toleráveis)
- **Semanal**: drift unresolved, semantic review SLA
- **Mensal**: rollback drill, RFC SLA, consumer audit

## Consequências de violação

| Violação                                  | Ação automática                                  |
| ----------------------------------------- | ------------------------------------------------ |
| Runtime incident                          | Acionar kill switch, congelar Wave seguinte      |
| Drift unresolved > 5% por 2 semanas       | Pausa em todas as RFCs até resolução            |
| Unregistered consumer detectado           | Suspender consumer, abrir incidente              |
| Rollback drill > 2 min                    | Bloquear ativação de runtime até remediar       |
| RFC SLA > 14 dias                         | Escalar para CTO/Pedagogia                       |

## Baseline (a calibrar nos primeiros 30 dias)

Coletar via Observatory:
- `drift_count` médio
- volume diário de `ontology_access_log`
- distribuição de `resolution_type` no backlog
- número de consumers ativos

Após 30 dias, baseline é fixada e qualquer desvio >2σ vira alerta operacional.
