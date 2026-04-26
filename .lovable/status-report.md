# ENAZIZI — Relatório de Status Atual

**Última atualização:** 2026-04-26
**Estado oficial:** 🧊 Freeze observacional ativo (Fase 2)

---

## Linha do tempo

| Fase | Estado | Resumo |
|---|---|---|
| **Fase 1 — Telemetria crítica** | ✅ **Concluída** | Telemetria corrigida e validada (de 1/14 → 12/14 eventos no Health Check). |
| **Fase 2 — Freeze observacional** | 🧊 **Ativa** | Sem mudanças em UI, rotas, jornada ou novas features. Apenas observação. |
| **Fase 3 — Cirurgia baseada em dados** | ⏳ Bloqueada | Só inicia após baseline atingida. |

---

## ✅ Fase 1 — Telemetria (RESOLVIDA)

**Status anterior:** 🔴 Telemetria quebrada (1/14 eventos chegando ao banco).
**Status atual:** 🟢 **Telemetria corrigida, em coleta observacional.**

### Eventos validados em produção
- `study_session_started`
- `first_question_loaded`
- `first_answer_submitted`
- `study_session_completed`
- `tutor_opened`
- `tutor_message_sent`
- `tutor_response_received`
- (+ demais eventos do funil; total 12/14 confirmados)

### Eventos ainda ausentes (esperado)
2 eventos dependem de comportamento real prolongado e devem aparecer naturalmente
durante a janela observacional. **Não são bug** — são consequência de uso real
ainda baixo.

### Validação
- `/admin/telemetry` → aba **Saúde** → "Rodar teste de funil" → todos OK.
- Fluxo real validado: Hoje → Continuar → responder questão → Tutor → mensagem.

---

## 🧊 Fase 2 — Freeze observacional (ATIVA)

Detalhes operacionais em `.lovable/observational-freeze.md`.
Critérios de saída em `.lovable/sprint-5.1-baseline-contract.md`.

### Regra atual
> Não mexer em nada que possa contaminar a baseline.

### Proibido durante a Fase 2
- ❌ Mudar UX/UI/navegação/sidebar
- ❌ Adicionar novos eventos de telemetria
- ❌ Criar dashboards, alertas, exportações ou simuladores
- ❌ Otimizações preventivas / "por feeling"
- ❌ Refactor visível ao usuário

### Permitido
- ✅ Observar `/admin/telemetry` (funil, retenção, tutor)
- ✅ Corrigir bugs críticos que **quebrem** a coleta
- ✅ Corrigir bugs críticos que impeçam o uso normal do produto

---

## ⏳ Pendências — só executar APÓS baseline

Estas decisões existem, mas **não devem ser tocadas agora**. Serão revistas
com dados reais quando a baseline fechar.

| # | Item | Por que esperar |
|---|---|---|
| 1 | Consolidar planner oficial | Decidir quais módulos sobrevivem com base em uso real |
| 2 | Consolidar mnemônico em 1 rota | Evitar consolidar a versão que ninguém usa |
| 3 | Revisar FSRS / `schedule-review` | Confirmar se o ciclo de revisão é realmente acionado |
| 4 | Decidir Mind Maps / ENAFLIX / Radar | Manter, fundir ou remover conforme conversão real |
| 5 | Limpar páginas órfãs e admin redundante | Identificar com dados o que é morto vs subutilizado |

---

## 🎯 Critérios para sair da Fase 2

Saída da Fase 2 só ocorre quando **TODOS** forem verdade:

- [ ] ≥ **10 usuários** distintos
- [ ] ≥ **100 sessões** únicas (`study_session_started`)
- [ ] ≥ **30** `first_question_loaded`
- [ ] ≥ **7 dias corridos** de coleta
- [ ] mobile + desktop ambos > 0
- [ ] **zero mudanças** em UI/rotas durante a janela

Quando os 6 forem ✅ → publicar baseline v1 → iniciar Fase 3.

---

## Referências

- `.lovable/observational-freeze.md` — regras detalhadas do freeze
- `.lovable/sprint-5.1-baseline-contract.md` — contrato formal da baseline
- `.lovable/sprint-5.1-meaningful-action-definition.md` — definição de "ação significativa"
- `.lovable/sprint-5.1-baseline-queries.sql` — queries de leitura da baseline
- `.lovable/sprint-5.1-observational-gaps-backlog.md` — gaps reconhecidos (não instrumentar)

---

## Resumo em uma linha

> **Telemetria viva. Sistema parado. Dados a caminho.**
