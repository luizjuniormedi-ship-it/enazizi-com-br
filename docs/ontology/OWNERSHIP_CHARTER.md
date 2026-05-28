# Ontology Ownership Charter — Freeze v25

Ownership oficial da camada ontológica do ENAZIZI. **Sem owner explícito, a ontologia degrada inevitavelmente.**

## Matriz de Ownership

| Área                     | Owner oficial             | Responsabilidade                                              |
| ------------------------ | ------------------------- | ------------------------------------------------------------- |
| Curriculum RFC           | Coordenação pedagógica    | Aprovar/rejeitar specialties, topics, mudanças curriculares    |
| Drift Review             | Arquitetura + Pedagogia   | Aplicar matriz de drift, escalonar reincidências              |
| Semantic Observatory     | Plataforma                | Manter dashboards, snapshots, integridade das views           |
| Rollback Authority       | Engenharia                | Executar kill switch, drills mensais, validar reversibilidade |
| Ontology Versions        | Governance Board          | Aprovar nova version, deprecar versions antigas               |
| Consumer Certification   | Arquitetura               | Validar L0→L5, manter `registered_consumers` íntegra          |
| Runtime Activation       | Comitê Técnico            | Aprovar qualquer ligamento de `ontology_runtime_enabled`      |

## Regras de delegação

- Nenhuma decisão ontológica unilateral. Toda ação ontológica precisa do owner correspondente.
- Owner ausente >30 dias → área é congelada (read-only) até reatribuição formal.
- Conflito entre owners → escalado para Semantic Governance Board.

## Auditoria

- Toda decisão ontológica relevante é registrada em `ontology.semantic_change_audit` (append-only).
- Owner deve constar em `change_reason` ou notes.
