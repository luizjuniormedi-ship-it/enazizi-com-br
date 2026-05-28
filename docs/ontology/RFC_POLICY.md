# Ontology RFC Policy — Freeze v25

Toda mudança ontológica futura exige RFC formal. **Sem exceções.**

## Conteúdo obrigatório de uma RFC

Toda RFC ontológica precisa, no mínimo, dos 7 campos:

1. **Motivação** — qual problema curricular/semântico resolve
2. **Impacto pedagógico** — efeito esperado na experiência do aluno (deve ser zero durante Freeze v25)
3. **Rollback strategy** — comando SQL ou procedimento exato para reverter
4. **Drift analysis** — previsão de novos drifts gerados e mitigação
5. **Owner definido** — nome + área (conforme `OWNERSHIP_CHARTER.md`)
6. **Rollout plan** — fases, gates, métricas de sucesso
7. **Approval humano** — assinatura do Semantic Governance Board

## Tipos de RFC

| Tipo                          | Aprovação mínima                       | SLA decisão |
| ----------------------------- | -------------------------------------- | ----------- |
| Specialty nova                | Pedagogia + Arquitetura + Conteúdo     | 14 dias     |
| Specialty deprecada           | Pedagogia + Conteúdo                   | 14 dias     |
| Nova `ontology_version`       | Governance Board completo              | 14 dias     |
| Promoção de consumer          | Arquitetura + Comitê Técnico           | 7 dias      |
| Ligamento de runtime          | Comitê Técnico (unânime)               | 30 dias     |
| Mudança em policy/RLS         | Arquitetura + Plataforma               | 7 dias      |

## RFCs vetadas por padrão durante Freeze v25

- Conectar Planner/FSRS/Tutor/TRI/Simulados à ontologia
- Auto-sync ontology → legacy
- Dual-write ontology + legacy
- Uso de IA ou heurística para classificação automática
- Sobrescrever `questions_bank.specialty_id` por inferência semântica

## Workflow

1. Autor abre RFC em documento versionado.
2. Board recebe na pauta da próxima reunião quinzenal.
3. Discussão → decisão (aprovado / rejeitado / pedido de revisão).
4. Se aprovado: execução condicionada ao rollout plan + drift drill.
5. Decisão final registrada em `semantic_change_audit`.

## Critério de qualidade

RFC sem rollback explícito ou sem owner identificado é **automaticamente rejeitada** sem discussão.
