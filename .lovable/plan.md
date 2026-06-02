
# WAR ROOM — LOOP PEDAGÓGICO (P0)

## Objetivo único

Provar, com evidência SQL + logs reais de produção, que o fluxo abaixo funciona ponta a ponta para um aluno real:

```text
Simulado
  → simulado_answers
  → practice_attempts
  → error_bank
  → fsrs_cards
  → Planner enxerga
```

Critério de encerramento: **PASSOU** (todos os 5 elos confirmados) ou **FALHOU** (com elo defeituoso identificado e issue aberta).

Prazo alvo: **24–48h**. Congelamento: Intel-1.5, Planner V4, Intel-2 e qualquer nova feature ficam bloqueados até veredito.

---

## Suspeita inicial (a confirmar)

Snapshot atual:

```text
simulado_sessions = 3.305
simulado_answers  = 0
practice_attempts = 0
error_bank        = 3
fsrs_cards        = 117
```

Hipóteses prováveis, em ordem de risco:

1. Frontend nunca chamou `insert` em `simulado_answers` / `practice_attempts` (caminho de escrita ausente ou desligado por flag).
2. Chamava, mas batia em 403 silencioso (GRANTs faltando — já corrigido) e o erro nunca foi exibido/loggado.
3. Existe escrita, mas em outra tabela legada (ex.: só `simulado_sessions.answers` JSON) e nada propaga para `error_bank` / `fsrs_cards`.
4. Escrita ocorre apenas via edge function com `service_role`, e a função não está sendo invocada no submit do simulado.

A sprint precisa **distinguir entre essas 4** antes de qualquer correção.

---

## Fases

### FASE 0 — Baseline congelado (30 min, sem código)

```text
- Snapshot SQL das 5 tabelas (count + max(created_at))
- Snapshot por user_id dos últimos 7 dias
- Salvar em /mnt/documents/war-room-loop/baseline.md
- Tag de release atual (commit hash) registrada no relatório
```

Sem isso, nenhum delta posterior é confiável.

### FASE 1 — Auditoria de código do caminho de escrita (2–4h, read-only)

Mapear, com `rg`, **todos** os pontos do frontend e edge que tocam:

```text
simulado_sessions   (insert/update)
simulado_answers    (insert)
practice_attempts   (insert)
error_bank          (insert/update)  → já existe errorBankLogger.ts
fsrs_cards          (insert)         → já existe fsrsAutoCreate.ts
```

Para cada ponto, registrar em tabela:

```text
Arquivo | Função | Tabela | Tipo | Cliente (anon/auth/service) | Flag de feature | Log LOOP_CAPTURE?
```

Saída: `war-room-loop/audit-write-paths.md`. Identifica se a escrita **existe no código**.

### FASE 2 — Instrumentação LOOP_CAPTURE_* completa (2–3h, código)

Onde já existe escrita mas **não** há log padronizado, adicionar:

```text
[LOOP_CAPTURE_SIMULADO_ANSWERS_OK]    { sessionId, questionId, isCorrect }
[LOOP_CAPTURE_SIMULADO_ANSWERS_FAIL]  { error }
[LOOP_CAPTURE_PRACTICE_ATTEMPTS_OK]   { topicId, isCorrect }
[LOOP_CAPTURE_PRACTICE_ATTEMPTS_FAIL] { error }
[LOOP_CAPTURE_ERROR_BANK_OK]          { tema, vezesErrado }
[LOOP_CAPTURE_ERROR_BANK_FAIL]        { error }
[LOOP_CAPTURE_FSRS_OK]                { cardType, refId }   ← já existe
[LOOP_CAPTURE_FSRS_FAIL]              { error }             ← já existe
```

Regras:
- Logar **sempre** OK e FAIL (não silenciar `error` do supabase-js).
- Nunca usar `try/catch` que engole erro sem logar.
- Manter o mesmo prefixo `[LOOP_CAPTURE_*]` para facilitar grep nos logs do browser e em `function_edge_logs`.

Risco controlado: mudança apenas em logs e em pontos de escrita já existentes — não cria lógica nova, não altera Planner/Tutor/Missão/FSRS algorítmico.

### FASE 3 — Correção mínima do elo quebrado (condicional)

Acionada **apenas se** a Fase 1 mostrar que a escrita está ausente.

Política:
- Corrigir 1 tabela por vez, na ordem `simulado_answers` → `practice_attempts` → `error_bank` (FSRS já é alimentado por trigger via `errorBankLogger`).
- Sem refactor. Sem extrair hook. Patch cirúrgico no submit do simulado.
- Cada PR carrega: diff, log esperado, query de verificação.

### FASE 4 — Deploy controlado em produção (1h)

```text
- Build local OK
- Deploy
- Confirmar bundle: grep "LOOP_CAPTURE_SIMULADO_ANSWERS_OK" no JS publicado
- Confirmar versão (commit hash) no /healthz ou meta tag
```

Sem essa confirmação, o teste humano não é válido (já caímos nisso antes).

### FASE 5 — Teste real com aluno (humano, 30 min)

Protocolo:

```text
1. Login como aluno comum (não admin, não service_role)
2. Abrir DevTools → Console → filtro: LOOP_CAPTURE
3. Iniciar 1 simulado de 10 questões
4. Errar intencionalmente 3 questões
5. Finalizar simulado
6. Salvar HAR + screenshot do console
7. Anotar user_id e session_id
```

Esse passo **só** pode ser executado pelo humano (o agente não tem credencial de aluno e usar service_role invalidaria o teste).

### FASE 6 — Verificação SQL (15 min)

Para o `user_id` testado, rodar:

```sql
SELECT 'sessions'  AS t, count(*) FROM simulado_sessions  WHERE user_id=$1 AND created_at > now()-interval '1 hour'
UNION ALL SELECT 'answers',   count(*) FROM simulado_answers   WHERE user_id=$1 AND created_at > now()-interval '1 hour'
UNION ALL SELECT 'attempts',  count(*) FROM practice_attempts  WHERE user_id=$1 AND created_at > now()-interval '1 hour'
UNION ALL SELECT 'errors',    count(*) FROM error_bank         WHERE user_id=$1 AND updated_at > now()-interval '1 hour'
UNION ALL SELECT 'fsrs',      count(*) FROM fsrs_cards         WHERE user_id=$1 AND created_at > now()-interval '1 hour';
```

Critérios de aprovação:

```text
sessions  ≥ 1
answers   = nº de questões respondidas (10)
attempts  ≥ nº de questões respondidas
errors    ≥ nº de erros intencionais (3)
fsrs      ≥ nº de erros novos
```

### FASE 7 — Verificação do Planner (15 min)

Confirmar que o Planner **lê** os dados novos:

```text
- daily_plan_tasks gerados após o teste referenciam:
  - error_bank.id criados na Fase 5  OU
  - fsrs_cards.due ≤ hoje criados na Fase 5
- study-next/orquestrador prioriza esses itens (log de decisão)
```

Sem isso, o loop está aberto na saída.

### FASE 8 — Veredito e relatório (30 min)

`/mnt/documents/war-room-loop/RELATORIO.md`:

```text
WAR ROOM — LOOP PEDAGÓGICO

BASELINE     (Fase 0)
AUDIT        (Fase 1)
PATCHES      (Fase 3, se houve)
DEPLOY HASH  (Fase 4)
EVIDÊNCIA HUMANA   (Fase 5: console + HAR)
EVIDÊNCIA SQL      (Fase 6)
EVIDÊNCIA PLANNER  (Fase 7)

ELO 1 sessions   ✅ / ❌
ELO 2 answers    ✅ / ❌
ELO 3 attempts   ✅ / ❌
ELO 4 errors     ✅ / ❌
ELO 5 fsrs       ✅ / ❌
ELO 6 planner    ✅ / ❌

DECISION: PASSOU / FALHOU
```

---

## Detalhes técnicos

- **Não** mexer em: algoritmo do Planner, Tutor IA, Missão do Dia, FSRS scheduler, Banco de Erros (lógica), RLS, policies.
- **Pode** mexer em: pontos de chamada `supabase.from(...).insert(...)` do submit do simulado, e apenas para garantir que existem + estão logados.
- Migrations: nenhuma esperada nesta sprint (GRANTs já aplicados). Se Fase 1 revelar coluna NOT NULL faltando no insert, abrir migration isolada e revisada.
- Edge functions: `study-complete` e `pedagogical-event-consumer` já existem e têm teste (`loop-validation.test.ts`, `run-alos-validation_test.ts`). Rodar esses testes na Fase 2 como sanity check antes do humano testar.
- Feature flags: verificar `new_fsrs_flow_enabled` em produção (afeta `fsrsAutoCreate`). Documentar valor atual no relatório.

## Riscos e mitigação

```text
Risco                                      Mitigação
─────────────────────────────────────────  ───────────────────────────────────────
Logs LOOP_CAPTURE não chegam ao bundle     Grep no JS publicado antes do teste humano
Teste humano com cache antigo              Hard reload + verificação de versão
service_role mascarando erro real          Teste obrigatório com usuário comum
Escrita assíncrona perdida                 await em todos inserts críticos do submit
Trigger DB silenciado                      Verificar pg_trigger e logs do postgres
```

## Bloqueios mantidos até PASSOU

```text
🔒 Intel-1.5
🔒 Planner V4
🔒 Intel-2
🔒 Qualquer nova feature ou dashboard
```

## Resultado esperado

```text
LOOP PEDAGÓGICO
Estrutural .... ✅
Operacional ... ✅  (com evidência humana + SQL + planner)
```

Aprovar este plano para eu iniciar pela **Fase 0 (baseline)** e **Fase 1 (auditoria read-only dos caminhos de escrita)** — ambas sem alterar código nem banco.
