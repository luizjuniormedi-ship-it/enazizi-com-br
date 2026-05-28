# NULL Resolution Roadmap — Safe Semantic Expansion

**Status:** Oficial · Freeze v25 · Enterprise Governance Mode
**Escopo:** Resolver progressivamente os 5.032 `questions_bank.specialty_id` NULL sem regressão sistêmica.
**Princípio oficial:** *"NULL correto é melhor do que classificação errada."*

---

## Objetivo

Expandir semanticamente os 5.032 NULL restantes com:

- risco controlado,
- rollback instantâneo,
- zero impacto em FSRS / Planner / Tutor / TRI / Simulados / Scheduling / Analytics históricos,
- `specialty_id` legado preservado como autoridade oficial.

**NÃO é objetivo:** forçar 100% de classificação.
**É objetivo:** expandir semanticamente com governança humana contínua.

---

## Princípio de Não-Interferência

A ontologia (`ontology.*`):

- ✅ observa, relaciona, organiza, enriquece, governa
- ❌ não substitui, não sincroniza, não sobrescreve, não autopromove

Runtime legado oficial: **`questions_bank.specialty_id`**.

---

## Fases Oficiais

### Fase 1 — Estabilização (30–60 dias) — **ATUAL**

| Permitido | Proibido |
|-----------|----------|
| Observatory | runtime ontology |
| RFC review | dual-write |
| Drift review | FSRS / Planner / Tutor integration |
| Shadow metrics | auto-classification |
| Semantic backlog | auto-promotion |
| Rollback drills | — |

**Meta:** provar que a governança humana funciona em regime contínuo.

---

### Fase 2 — Curriculum RFCs

RFCs formais obrigatórios antes de qualquer decisão de classificação:

| Tema | Decisão necessária |
|------|--------------------|
| Anestesiologia | specialty própria? |
| Radiologia | specialty própria? |
| Nutrição | specialty própria? |
| Clínica Médica | transversal? |
| Hemostasia | domain ou subtopic? |
| Emergência | specialty ou domain? |

Cada RFC contém: owner, impacto pedagógico, impacto analytics, rollback, ontology mapping, consumers afetados.

**Sem RFC aprovado → NULL permanece NULL.**

---

### Fase 3 — Wave 2 Controlada

**Gates obrigatórios** (todos verdes):

- 30 dias sem incidentes
- Rollback drill aprovado
- Drift estável (`v_ontology_health.drift_count` dentro do baseline)
- Observability saudável
- Semantic Board operacional

**Ação:** popular 200–500 novos `ontology.semantic_resolution_status` incluindo transversais, cross-domain, multi-axis.

Continua proibido: IA, heurística automática, criação de specialty automática.

---

### Fase 4 — Classificação Multi-Eixo

Modelo legado: `1 questão = 1 specialty`.
Modelo semântico: `1 questão = N relações`.

Exemplo (TEP): Cardiologia + Emergência + Hemostasia + Terapia Intensiva + Pneumologia.

**`specialty_id` legado permanece imutável.**

---

### Fase 5 — Shadow Consumers

Primeiros consumers permitidos (sem efeito em scheduling/scoring):

- analytics internos
- observabilidade
- dashboards

**Ainda proibido:** scheduling, scoring, FSRS, Planner, Tutor, TRI, simulados.

Toda divergência é logada, auditável e reversível.

---

### Fase 6 — Human Review Pipeline

Semantic noise nunca é resolvido automaticamente.

Categorias: Geral · Diagnóstico · Tratamento · Anatomia isolada · Subtemas vagos.

Fluxo: **detection → RFC candidate → human review → ontology decision → controlled rollout**.

---

### Fase 7 — Longitudinal Validation

Antes de qualquer integração de runtime, medir por meses:

- drift
- retention impact
- recommendation stability
- scheduling stability
- analytics consistency
- semantic conflict rate

---

### Fase 8 — Runtime Integration (Futuro)

Permitido apenas com:

- ✅ rollback instantâneo
- ✅ shadow accuracy validada
- ✅ drift baixo
- ✅ Semantic Board maduro
- ✅ observability saudável
- ✅ zero regressão pedagógica
- ✅ consumers certificados
- ✅ rollout canário aprovado

E mesmo assim: **gradual, feature-flagged, fail-closed, shadow-first.**

---

## Proibições Absolutas

- ❌ IA para preencher `specialty_id`
- ❌ Fuzzy match automático
- ❌ Reduzir thresholds
- ❌ Criar specialty automaticamente
- ❌ Sobrescrever runtime legado
- ❌ Ligar `ontology_runtime_enabled` globalmente
- ❌ Alterar FSRS sem shadow validation
- ❌ Alterar scheduling sem métricas longitudinais
- ❌ Transformar NULL em lixo classificado

---

## Veredito

O problema restante **não é engenharia básica** — é governança curricular, semântica multi-eixo e operação humana contínua.

Caminho correto:

- expandir lentamente
- medir tudo
- preservar rollback
- proteger runtime legado
- operar com disciplina

**Resolver os 5.032 NULL sem jamais quebrar o que já funciona.**
