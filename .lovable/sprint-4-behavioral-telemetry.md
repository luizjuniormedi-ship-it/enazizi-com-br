# Sprint 4 — Telemetria Comportamental (tempo-até-ação)

**Data:** 2026-04-23
**Escopo:** instrumentação leve para medir comportamento real do aluno.
**Filosofia:** observar > opinar. Zero UX nova, zero arquitetura.

---

## O que foi medido

A pergunta central da sprint:
> Quanto tempo o aluno leva entre **entrar no app** e **realmente começar a estudar**?

E secundárias:
- Qual é o **ponto de entrada** mais eficiente (Visão Geral, Estudar, ENAFLIX, IA)?
- Quantos **cliques** e **mudanças de rota** o aluno faz antes de agir?
- O **CTA dominante** (Sprint 3) realmente reduziu hesitação no mobile?

---

## Como funciona

### 1. `markSessionStart()`
- Disparado pelo `useTimeToAction` em `DashboardLayout` no momento em que o usuário autenticado monta o layout.
- Persiste timestamp em `sessionStorage` (sobrevive a navegação SPA, NÃO a fechar a aba — é exatamente o intervalo "sessão de uso real").
- Idempotente.

### 2. `useTimeToAction()`
- Marca início da sessão e dispara `session_start`.
- Conta cliques globais via `window.addEventListener('click', ..., {capture:true,passive:true})` — para de contar após a primeira ação real.
- Conta mudanças de rota via `useLocation`.

### 3. `trackStudyAction(userId, entryPoint, actionKind, meta?)`
- Dispara `first_meaningful_action` (deduplicado por sessão-aba) **e** `study_action_started` (sem dedupe).
- Insere em `behavioral_telemetry` via PostgREST, fire-and-forget.

### 4. Pontos instrumentados
| Local | entry_point | action_kind |
|---|---|---|
| `MissionStartButton` (idle, /dashboard) | `visao_geral` | `start_mission` |
| `MissionStartButton` (autostart via MissionEntry) | `estudar` | `start_mission` |
| `MissionStartButton` (paused/active resume) | `mission_resume` | `resume_mission` / `continue_session` |
| `OperationalHub` — Iniciar tema | `estudar` | `start_topic` |
| `OperationalHub` — Iniciar revisão (cards + linha mobile) | `estudar` | `start_review` |
| `OperationalHub` — Revisar erros | `estudar` | `open_errors` |
| `OperationalHub` — Iniciar simulado | `estudar` | `start_simulado` |
| `OperationalHub` — Tutor IA | `estudar` | `open_tutor` |

> Cliques em **menus, perfil, scroll, ENAFLIX discovery** **não** disparam ação real, conforme regra da sprint.

---

## Esquema de dados

### `behavioral_telemetry`
| coluna | tipo | uso |
|---|---|---|
| `user_id` | uuid | sempre `auth.uid()` (RLS) |
| `event_type` | text | `session_start` / `first_meaningful_action` / `study_action_started` |
| `entry_point` | text | `visao_geral` / `estudar` / `enaflix` / `ia` / `mission_resume` / `other` |
| `action_kind` | text | ver tabela acima |
| `route` | text | rota no momento da ação |
| `viewport` | text | `mobile` (<640px) / `desktop` |
| `ms_since_session_start` | int | **métrica principal** |
| `pre_action_clicks` | int | hesitação |
| `pre_action_route_changes` | int | hesitação |
| `metadata` | jsonb | contexto livre |

### RLS
- Aluno: lê e insere apenas os próprios eventos.
- Admin: lê tudo.

### View `v_time_to_action_summary`
Resumo agregado diário com:
- `sessions`, `avg_seconds_to_action`, `median_seconds_to_action`,
- `avg_clicks_before`, `avg_route_changes_before`,
- quebra por `viewport`, `entry_point`, `action_kind`.

---

## Queries de relatório (rodar como admin)

**Tempo médio até ação por viewport (últimos 7 dias):**
```sql
SELECT viewport,
       ROUND(AVG(avg_seconds_to_action), 1) AS avg_seconds,
       SUM(sessions) AS sessions
FROM v_time_to_action_summary
WHERE day >= current_date - 7
GROUP BY viewport;
```

**Ponto de entrada mais eficiente:**
```sql
SELECT entry_point,
       ROUND(AVG(median_seconds_to_action), 1) AS median_seconds,
       SUM(sessions) AS sessions
FROM v_time_to_action_summary
WHERE day >= current_date - 7 AND entry_point IS NOT NULL
GROUP BY entry_point
ORDER BY median_seconds ASC;
```

**Hesitação (cliques antes da ação):**
```sql
SELECT viewport, entry_point,
       ROUND(AVG(avg_clicks_before), 2) AS avg_clicks
FROM v_time_to_action_summary
WHERE day >= current_date - 7
GROUP BY viewport, entry_point
ORDER BY avg_clicks DESC;
```

**Hipótese D — Estudar é o ponto principal de execução?**
```sql
SELECT entry_point, COUNT(*) AS first_actions
FROM behavioral_telemetry
WHERE event_type = 'first_meaningful_action'
  AND created_at >= current_date - 7
GROUP BY entry_point
ORDER BY first_actions DESC;
```

---

## Hipóteses a validar (após 7 dias de dados)

| # | Hipótese | Como validar |
|---|---|---|
| A | Separação Visão Geral/Estudar/ENAFLIX reduziu hesitação | `avg_clicks_before` < 5 e `avg_route_changes_before` < 2 |
| B | CTA dominante mobile reduziu tempo até ação | mediana mobile ≤ desktop + 30% |
| C | KPIs abaixo da ação aumentaram execução em /sessao-estudo | sessões com `entry_point=estudar` em maioria |
| D | Aluno usa Estudar como ponto principal | `entry_point=estudar` é #1 ou #2 |

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/...behavioral_telemetry...` | nova tabela + view + RLS |
| `src/lib/behavioralTelemetry.ts` | helper fire-and-forget |
| `src/hooks/useTimeToAction.ts` | hook de contadores + session_start |
| `src/components/layout/DashboardLayout.tsx` | monta `useTimeToAction` (1 linha) |
| `src/components/dashboard/MissionStartButton.tsx` | track em start/resume/autostart |
| `src/components/study/OperationalHub.tsx` | track em todos os CTAs reais |

**Zero rotas mudadas, zero componentes novos visíveis ao usuário, zero mudança em `OperationalHub` UI.**

---

## Validação

- ✅ Migration aplicada (tabela + RLS + view).
- ✅ `useTimeToAction` rodando em `DashboardLayout` (carregado em todas as rotas pós-login).
- ✅ Inserts são fire-and-forget — qualquer erro vai para `console.warn` sem impactar UX.
- ✅ Dedupe de `first_meaningful_action` por sessão-aba (`sessionStorage`).
- ✅ Warnings do linter de segurança são pré-existentes (storage buckets, funções legadas) — nenhum criado pela sprint.

---

## O que **não** foi feito (intencional)

- ❌ Sem dashboard visual de métricas — relatório é via SQL/admin.
- ❌ Sem instrumentação de scroll/hover/menu — escopo restrito a "ação real".
- ❌ Sem mexer em `Visão Geral`, ENAFLIX, IA contextual.
- ❌ Sem nova rota, nova tabela além da telemetria, novo componente UI.

---

## Próximas sprints sugeridas (não execute sem aprovação)

1. **Sprint 5 — Análise dos primeiros 7 dias**: rodar queries acima, comparar com baseline da Sprint 3.
2. **Sprint 5 alt — Auditoria IA invisível**: mapear pontos onde IA aparece como menu vs ambiente.
3. **Sprint 5 alt — Auditoria silêncio visual no Dashboard**: contar elementos competindo por atenção.
