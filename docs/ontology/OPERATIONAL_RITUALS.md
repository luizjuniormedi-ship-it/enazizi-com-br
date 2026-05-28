# Ontology Operational Rituals — Freeze v25

Rituais obrigatórios para manter a camada ontológica governada, observável e reversível **sem expandir engenharia**.

> Princípio central: "Primeiro operar com segurança. Depois expandir."

## Cadência oficial

| Ritual                          | Frequência | Owner                | Saída obrigatória                       |
| ------------------------------- | ---------- | -------------------- | --------------------------------------- |
| Semantic RFC Review             | semanal    | Curriculum board     | Lista de RFCs priorizados ou descartados |
| Drift Review                    | semanal    | Platform admin       | Decisão por drift conforme matriz       |
| Ontology Health Review          | quinzenal  | Platform admin       | Snapshot de `v_ontology_health` arquivado |
| Rollback Drill                  | mensal     | Platform admin       | Log do drill (start/end/incidentes)     |
| Consumer Certification Review   | mensal     | Platform admin       | Auditoria de `registered_consumers` (L0–L5) |

## Semantic RFC Review (semanal)

1. Abrir `/admin/semantic-observatory`.
2. Aba **Pending Curriculum RFC** — revisar topics com `question_count` decrescente.
3. Para cada topic candidato:
   - Decisão: criar specialty? (requer RFC formal) · deprecar topic? · merge?
   - Registrar decisão no documento curricular (fora deste sistema).
4. **Proibido**: criar specialty nova sem RFC aprovado.

## Drift Review (semanal)

1. Carregar painel **Drift Governance Matrix**.
2. Para cada `drift_type` ativo, aplicar a ação da matriz (ver `DRIFT_GOVERNANCE_MATRIX.md`).
3. Drifts ignorados acumulam — qualquer tipo com >10 ocorrências exige escalonamento.

## Ontology Health Review (quinzenal)

1. Capturar snapshot completo via `SELECT public.ontology_observatory_snapshot()`.
2. Validar:
   - `unregistered_access_groups == 0`
   - `distinct_pinned_versions <= 2`
   - `orphan_semantic_links` estável ou decrescente
   - `drift_count` dentro de baseline
3. Arquivar snapshot em log operacional.

## Rollback Drill (mensal)

Sequência obrigatória, blast radius zero:

1. Confirmar `ontology_runtime_enabled = false` (estado default).
2. Ligar kill switch via service_role:
   ```sql
   UPDATE ontology.system_flags
   SET value = 'true'::jsonb
   WHERE flag_key = 'ontology_runtime_enabled';
   ```
3. Carregar `/admin/semantic-observatory` e validar leitura.
4. Validar via amostragem de 10 requests pedagógicos (Tutor/Planner/FSRS): **resultado idêntico** ao estado pré-drill (consumers em L0 ignoram a flag).
5. Desligar kill switch:
   ```sql
   UPDATE ontology.system_flags
   SET value = 'false'::jsonb
   WHERE flag_key = 'ontology_runtime_enabled';
   ```
6. Registrar drill em log operacional (timestamp, executor, incidentes).

**Critério de aprovação**: zero incidentes em 30 dias + drill mensal limpo.

## Consumer Certification Review (mensal)

1. Query: `SELECT * FROM ontology.registered_consumers ORDER BY rollout_stage, consumer_name`.
2. Validar:
   - Todo consumer em `internal/beta/canary/ga` tem owner identificado.
   - `ontology_version_pinned` corresponde a versão suportada.
   - Consumers críticos (Planner/FSRS/Tutor/TRI/Simulados) permanecem **L0** (não registrados como consumers ativos).
3. Promover consumer apenas via RFC formal e drill de rollback prévio.

## Gates para Wave 2

Wave 2 (transversal + cross-domain + multi-axis, 200–500 registros adicionais) **NÃO pode rodar** sem:

- [ ] 7 dias sem incidente desde Wave 1
- [ ] Rollback drill aprovado no mês corrente
- [ ] `v_ontology_health.drift_count` dentro de baseline
- [ ] `unregistered_access_groups == 0`
- [ ] Aprovação explícita registrada

Quando todos os gates passarem, executar inserção controlada análoga à Wave 1, expandindo o `topic_map` para os buckets transversal/cross-domain, mantendo `ON CONFLICT DO NOTHING` e `resolution_source = 'wave2_controlled_seed'`.
