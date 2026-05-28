# Drift Governance Matrix — Freeze v25

Matriz oficial de resposta a drifts semânticos detectados em `ontology.v_semantic_drift`.

> Nenhuma ação automática. Toda decisão é humana, registrada e reversível.

## Matriz oficial

| Drift Type                  | Ação obrigatória         | Owner             | SLA  |
| --------------------------- | ------------------------ | ----------------- | ---- |
| `specialty_mismatch`        | RFC review               | Curriculum board  | 7d   |
| `deprecated_node_link`      | Ontology cleanup         | Platform admin    | 14d  |
| `multiple_specialty_links`  | Human validation         | Curriculum board  | 7d   |
| `semantic_noise`            | Backlog review           | Platform admin    | 30d  |
| `unresolved_transversal`    | Curriculum board review  | Curriculum board  | 30d  |

## Definições

- **specialty_mismatch** — `question_semantic_links` aponta para specialty diferente do `questions_bank.specialty_id` legacy. Legacy é autoridade; ontology é candidate.
- **deprecated_node_link** — link aponta para `curriculum_nodes` em status `deprecated`. Cleanup: remover link via service_role, registrar em `semantic_change_audit`.
- **multiple_specialty_links** — mesma questão com >1 specialty_link ativo. Validar manualmente: é transversal legítimo ou erro?
- **semantic_noise** — topic genérico recorrente sem significado curricular. Decidir: aceitar como noise permanente ou deprecar topic.
- **unresolved_transversal** — questão marcada como transversal mas sem decisão curricular formal. Pauta de board.

## Fluxo operacional

1. Drift detectado é listado em `/admin/semantic-observatory`.
2. Owner identifica o drift type e aplica a ação correspondente.
3. Decisão registrada em `semantic_change_audit` (append-only) com `change_reason`.
4. Drift volta a aparecer apenas se reincidente — recorrência indica problema sistêmico.

## Escalonamento

- Drift type com >10 ocorrências ativas → escalar para Curriculum board.
- Drift sem owner por >30 dias → escalar para Platform admin.
- Reincidência após cleanup → bloquear consumer relacionado via `registered_consumers.active = false`.

## Proibições

- ❌ Auto-resolver drift via script ou IA
- ❌ Sobrescrever `questions_bank.specialty_id` para "resolver" drift
- ❌ Deletar registros de `semantic_change_audit`
- ❌ Promover ontology a autoridade sem RFC formal + rollback drill aprovado
