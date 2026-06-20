
# Memory Consolidation Engine + Cognitive Analytics

Motor único, 2 entregas: Sprint 1 coleta + integra; Sprint 2 visualiza para o professor.

## Guard-rails que a feature DEVE respeitar

- **Sprint 2.3 anti-pseudo-psicometria**: nada de discrimination/calibração com N baixo. Métricas de domínio/retenção/falsa confiança ficam marcadas como `experimental` até N≥30 por (aluno, tema) e N≥100 para qualquer recalibração de dificuldade. Ordem fixa: read-only → piloto 10 alunos → telemetria observacional → massa → calibração.
- **LGPD v25.1**: respostas do aluno na consolidação = `scope='user'`. Nada de promoção automática para global. PII passa por `pii-sanitizer.ts` se algum dia for agregada.
- **Escopo ENAZIZI**: nada compartilhado com ProntoMedic.
- **Freeze pós-v25**: feature nova é permitida, mas sem mexer em planner core, FSRS core, prompts mestres do Tutor V3 ou schema de `pedagogical_events`. Integração é por **novos eventos** no Event Bus existente.
- **Dashboard nomenclatura intocável**: novas telas entram como abas/cards adicionais, sem renomear módulos atuais.

## Arquitetura

```text
                MEMORY CONSOLIDATION ENGINE (novo)
                           │
   emite eventos via pedagogicalEventBus.emit(...)
                           │
   ┌───────────────┬───────┴────────┬──────────────┐
   ▼               ▼                ▼              ▼
Tutor V3      Error Bank          FSRS         Planner V3
   │               │                │              │
   └──────────────►│◄───────────────┘              │
                   ▼                               ▼
            Cognitive State                Cognitive Analytics
                                              (Professor)
```

Motor = edge function `memory-consolidation` + tabelas próprias + 5 eventos novos. Consumidores existentes (error-bank-writer, fsrs-scheduler, planner-core) só passam a **escutar** os novos eventos.

---

## SPRINT 1 — Memory Consolidation Engine (Aluno)

### 1.1 Schema (migration única)

Tabelas novas em `public`, com GRANT + RLS por `auth.uid()`:

- `memory_consolidation_sessions` — id, user_id, topic_id, subtopic_id, source ('tutor_v3'|'error_review'|'fsrs_due'), trigger_event_id, started_at, completed_at, status, mastery_score, confidence_score, false_confidence_flag, metacog_quality, summary_text.
- `memory_consolidation_responses` — id, session_id, user_id, step ('retrieval'|'connective_summary'|'metacog'|'confidence'), prompt, response, ai_evaluation jsonb, score numeric, latency_ms, created_at.
- `memory_consolidation_metrics` — id, user_id, topic_id, window ('7d'|'30d'|'90d'), mastery_avg, retention_index, false_confidence_rate, knowledge_gap_score, sample_size, is_experimental bool, computed_at. **Flag `is_experimental=true` quando sample_size<30.**

Tudo com `service_role` para edge functions, `authenticated` só lê/escreve linhas próprias.

### 1.2 Edge function `memory-consolidation`

Fluxo (curto, sem reescrever Tutor V3):

1. `start` — recebe `{topic, source, trigger_event_id}` → cria sessão → emite `MEMORY_CONSOLIDATION_STARTED`.
2. `retrieval` — 1 pergunta de recall ativa gerada pela mesma chain do Tutor V3 (`enazizi-prompt.ts`, reusa Recall layer). Avalia via IA, salva resposta + score.
3. `connective_summary` — pede resumo conectando ao tema anterior. IA avalia coerência + profundidade (depth≥2 da quality gate v22.1).
4. `metacog` — "o que você ainda não entendeu?" → score qualitativo.
5. `confidence` — slider 0-100 do aluno **antes** de ver gabarito final → comparado com mastery real → **False Confidence** = `confidence>=80 && mastery<60`.
6. `complete` — calcula mastery/confidence agregados, emite eventos conforme tabela abaixo, atualiza `memory_consolidation_metrics` (upsert por window).

Reusa: `tutor-v3-premium` para geração (não duplica prompts), `pii-sanitizer.ts` antes de qualquer log.

### 1.3 Eventos novos no Event Bus

Adicionar em `src/lib/pedagogicalEventBus.ts` + `src/lib/events.ts`:

| Evento | Payload mínimo | Quem consome |
|---|---|---|
| `MEMORY_CONSOLIDATION_STARTED` | session_id, topic_id, source | telemetria |
| `MEMORY_CONSOLIDATION_COMPLETED` | session_id, mastery, confidence, metacog_quality | FSRS, Planner |
| `FALSE_CONFIDENCE_DETECTED` | topic_id, confidence, mastery | Error Bank, Planner (boost +15) |
| `KNOWLEDGE_GAP_DETECTED` | topic_id, gap_score, subtopics[] | Planner, Tutor V3 (próxima sessão) |
| `REVIEW_PRIORITY_INCREASED` | topic_id, delta, reason | FSRS (antecipa due_date), Planner |

Consumers existentes (`pedagogical-event-consumer`) ganham apenas branches novos — sem refactor.

### 1.4 Integração no Tutor V3 (não-invasiva)

- Após `study-complete` do Tutor V3, novo hook `triggerConsolidation(topic, sessionId)` chama a edge function.
- UI nova: `<MemoryConsolidationCard />` aparece como passo final da SessaoEstudo (hub) — não substitui nada, é etapa adicional.
- Telemetria: usa `tutor_runtime_metrics` existente (campo `phase='consolidation'`).

### 1.5 Critérios de aceite Sprint 1

- Aluno completa sessão Tutor V3 → consolidação dispara → 4 etapas → eventos emitidos → FSRS e Error Bank reagem.
- Métricas com N<30 vêm marcadas `is_experimental` (guard-rail Sprint 2.3).
- Zero alteração em prompts mestres, planner core, FSRS core.
- Logs LGPD-safe (scope=user, sem PII em agregados).
- E2E: `e2e/memory-consolidation.spec.ts` cobrindo happy path + false confidence.

---

## SPRINT 2 — Cognitive Analytics (Professor)

Só começa quando Sprint 1 tiver ≥10 alunos piloto com ≥30 sessões cada (massa mínima para sair de `experimental`).

### 2.1 Sem schema novo
Tudo agrega de `memory_consolidation_metrics` + `memory_consolidation_sessions` via RPC `cognitive_analytics_dashboard(turma_id, window)`.

### 2.2 Telas (novas, sem renomear nada)
- `/professor/cognitive-analytics` — aba nova no Professor Command Center.
- Cards: ICE (Índice Cognitivo de Engajamento), Domínio %, Retenção, Falsa Confiança %, Lacunas top-5.
- Heatmap por (tema × aluno) e (tema × turma).
- Alertas Cognitivos: cards estilo "Arritmias — Domínio 41% — Risco ENAMED Alto — Ação: Reforço imediato" gerados a partir de regras determinísticas (não IA livre), respeitando thresholds Sprint 2.3.

### 2.3 Permissões
RLS: professor só vê alunos das próprias `professor_turma_students`. Reusa `useProfessorCheck.ts`.

### 2.4 Critérios de aceite Sprint 2
- Dashboard carrega <2s para turma de 50.
- Alertas mostram tag "experimental" enquanto N<30.
- Zero coleta nova; só leitura agregada.

---

## Detalhes técnicos

- Frontend Sprint 1: `src/components/study/MemoryConsolidationCard.tsx`, `src/hooks/useMemoryConsolidation.ts`.
- Edge: `supabase/functions/memory-consolidation/index.ts` (+ shared `consolidation-scoring.ts`).
- Tipos: `src/types/memoryConsolidation.ts` + eventos em `src/lib/events.ts`.
- Tests: e2e Playwright + contract test no Edge.
- Feature flag: `memory_consolidation_enabled` em `feature_flags` (rollout 10% → 50% → 100%).

## O que NÃO entra agora

- Calibração TRI baseada em mastery (viola Sprint 2.3 enquanto N<100).
- Promoção automática para `tutor_memory` global (viola LGPD v25.1).
- Refactor do Planner core ou FSRS core (viola freeze).
- Qualquer tela no ProntoMedic.

---

Confirma que sigo com **Sprint 1 (migration + edge + eventos + UI mínima)** agora?
