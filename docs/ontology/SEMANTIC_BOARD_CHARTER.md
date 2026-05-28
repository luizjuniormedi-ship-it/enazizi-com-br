# Semantic Governance Board — Charter

Ritual humano formal de governança ontológica do ENAZIZI.

## Composição

| Cadeira       | Função                                                   |
| ------------- | -------------------------------------------------------- |
| Arquitetura   | Integridade técnica, consumer certification, rollout     |
| Pedagogia     | Validação curricular, impacto pedagógico, sequência ENSINAR→TESTAR→CORRIGIR |
| Conteúdo      | Coerência com bibliografia oficial (Nelson, Sabiston…)   |
| Plataforma    | Operação do Observatory, snapshots, performance          |
| Analytics     | Métricas, SLOs, baseline de drift                        |

## Cadência

- **Reunião quinzenal** obrigatória (45 min).
- **Pauta fixa**:
  1. RFCs abertos (decisão go/no-go)
  2. Drifts ativos por tipo (aplicar matriz)
  3. Backlog semântico (priorizar)
  4. Health snapshot (revisar)
  5. Pedidos de promoção de consumer L0→L1 (avaliar)

## Decisões formais

O Board é a **única autoridade** para:

- Criar/deprecar specialty
- Criar/aprovar nova `ontology_version`
- Promover consumer (L0→L1→…→L5)
- Ligar `ontology_runtime_enabled` globalmente
- Aprovar execução de Wave 2+

Decisões registradas em ata + `semantic_change_audit`.

## Vetos automáticos

- Qualquer decisão sem owner identificado → vetada.
- Qualquer mudança sem rollback strategy → vetada.
- Qualquer expansão de consumer crítico (Planner/FSRS/Tutor/TRI/Simulados) durante Freeze v25 → vetada.

## Escalation

- Empate técnico/pedagógico → CTO + Diretor Pedagógico decidem em 48h.
- Conflito de owner → Board decide por maioria simples.
