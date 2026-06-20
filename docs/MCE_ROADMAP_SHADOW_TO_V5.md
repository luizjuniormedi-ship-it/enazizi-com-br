# MCE — Roadmap Shadow → V5

**Status:** Shadow Validation ativa (V4 em produção, flag `memory_consolidation_enabled` em 0%, override via `localStorage.MCE_ENABLED`)
**Decisão:** V5 **NÃO inicia** até shadow validar. Risco atual é pedagógico, não técnico.

---

## Sprint Atual — Shadow Validation (3–7 dias)

Coleta passiva de telemetria. `advance_allowed` não bloqueia. Card renderiza, aluno responde, sinais vão para `memory_consolidation_sessions` + `pedagogical_events`.

### Métricas observadas
- Completion Rate
- Abandonment Rate (saída antes do `complete`)
- Tempo médio por sessão MCE
- Distribuição de `mastery_score`
- Distribuição de `confidence_score`
- Taxa de **falsa confiança** detectada
- Distribuição por rigor: `full` / `standard` / `simplified`

### KPIs de saída (gate para Sprint 4.2)
| KPI | Mínimo |
|---|---|
| Completion Rate | > 70% |
| Abandonment Rate | < 25% |
| Tempo médio | < 90s |
| False confidence detectada | > 0 ocorrências |
| Erros Edge críticos | 0 |

Se algum KPI falhar → **corrigir UX/rigor antes de avançar**, não pular para analytics.

---

## Sprint 4.2 — Analytics Foundations (após shadow OK)

**Sem V5 ainda.** Apenas começar a formar histórico.

Persistir nos registros de sessão MCE (default 0, não usado em produção):
```json
{
  "ice_score": 0,
  "enamed_risk_score": 0
}
```

Objetivo único: ter colunas/estrutura prontas para backfill quando V5 entrar. Nenhum consumidor lê esses campos ainda.

---

## Sprint V5 — Cognitive Analytics (gate: N ≥ 500 sessões MCE reais)

Só abre quando o histórico de shadow + 4.2 acumular **≥ 500 sessões completas**.

### ICE Score
Retrieval + Generation + Metacognition + Confidence Calibration + Consistency

### ENAMED Risk Score
Incidência + Mastery + False Confidence + Retenção + Erro recorrente

### Cognitive Analytics (Professor)
- Heatmaps
- ICE por aluno/turma
- ENAMED Risk
- Top Gaps
- Top False Confidence

---

## Decisão registrada
- ✅ Continuar rollout shadow do V4
- ❌ Não iniciar V5
- ⏳ Coletar ≥ 500 sessões reais antes de qualquer score sofisticado

**Racional:** o risco hoje não é calcular ICE errado. É descobrir que aluno abandona no passo 3, ou que FULL é longo demais dentro do Tutor. Esses sinais só aparecem com uso real.
