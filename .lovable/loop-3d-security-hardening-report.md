# Loop Segurança 3D — Hardening sem alterar features

Data: 2026-05-09
Escopo estrito: corrigir Security Definer Views, search_path mutable, e mapear Edge Functions com auth legado. **Sem alterar UI, sem alterar algoritmos pedagógicos.**

---

## 1. Views Corrigidas (6/6) ✅

Todas convertidas para `security_invoker = true` (ALTER VIEW). Agora a RLS do **caller** é avaliada em vez da do owner (`postgres`). Nenhum dado migrado.

| View | Antes | Depois |
|---|---|---|
| `cme_session_aggregation_summary` | herdava perms do owner | RLS do caller |
| `lesson_rating_stats` | herdava perms do owner | RLS do caller |
| `noc_metrics` | herdava perms do owner | RLS do caller |
| `prompt_performance_analytics` | herdava perms do owner | RLS do caller |
| `tutor_health_metrics` | herdava perms do owner | RLS do caller |
| `v_time_to_action_summary` | herdava perms do owner | RLS do caller |

**Confirmado pelo linter:** 6 ERROR `0010_security_definer_view` removidos.

---

## 2. Funções com search_path Corrigidas (27/27) ✅

Todas receberam `SET search_path = public` via `ALTER FUNCTION`. Bloqueia search_path hijack.

`aggregate_cme_quality_to_project`, `calculate_blueprint_health`, `calculate_cme_media_health_score`, `check_cme_publication_readiness`, `check_cognitive_recovery_mode`, `check_system_health`, `check_video_lesson_media_validity`, `ensure_adaptive_schedule_profile`, `generate_intervention_explanation`, `get_active_blueprint`, `handle_updated_at`, `increment_hallucination_count`, `log_cme_status_change`, `normalize_medical_topic`, `sync_cme_reference_status`, `sync_cme_scene_graph_payload`, `sync_cognitive_rhythm`, `track_incident_from_error`, `trig_update_topic_normalized`, `trigger_cleanup_tutor_cache`, `trigger_cme_operational_alert`, `trigger_update_cme_health_score`, `update_node_mastery_metrics`, `update_notebooklm_updated_at`, `update_rag_timestamp`, `update_simulation_job_updated_at`, `update_updated_at_column`.

**Confirmado pelo linter:** 27 WARN `0011_function_search_path_mutable` removidos.

---

## 3. Edge Functions com Auth Legado — Mapeamento e Prioridade

Fonte: `docs/edge-functions-auth-audit.md` + grep dinâmico em `supabase/functions/*/index.ts` por `auth.getUser()`.

**Nenhuma function foi modificada nesta loop** (escopo: mapear + priorizar).
Funções já protegidas via `_shared/standard-handler.ts` (que faz `getClaims` desde Sprint 1) **não estão na lista** abaixo.

### P0 — Crítico (queima crédito IA + verify_jwt=false sem getClaims)
Migrar primeiro. São AI generators expostos publicamente.

1. `learning-optimizer`
2. `generate-study-plan`
3. `clinical-simulation`
4. `discursive-questions`
5. `feynman-trainer`
6. `motivational-coach`
7. `anamnesis-trainer`

**Plano:** trocar handler por `handleStandardEdgeFunction` (já existente). Diff médio: ~10 linhas por função.

### P1 — Alto (admin/dashboards)
8. `dashboard-snapshot`
9. `system-health-check`
10. `performance-predictor`
11. `mentor-chat` (tem manual check; falta rate-limit por user_id)

### P2 — Médio (lookups read-only, baixo custo de abuso)
12. `medical-term-lookup`
13. `benchmark-percentile`

### P3 — Webhooks (auth via signature, NÃO migrar para getClaims)
Validam segredo upstream — manter como está, **mas auditar segredo presente:**
- `auth-email-hook` (Supabase webhook secret)
- `whatsapp-agent`, `whatsapp-auto-send`, `whatsapp-opt-out`, `whatsapp-queue`, `daily-bi-whatsapp`
- `telegram-classroom`

### P4 — Cron / service-role only
Devem rejeitar chamadas sem segredo de cron interno. Auditar mas **não migrar para getClaims**:
- `daily-question-generator`, `system-daily-monitor`, `enamed-generator`, `auto-assign-simulados`, `professor-reminder`, `process-email-queue` (já com `verify_jwt=true`).

---

## 4. Risco Residual

| Item | Severidade | Status |
|---|---|---|
| 7 AI generators P0 sem getClaims | **Alto** (drena crédito IA) | Pendente — Loop 3E |
| 4 funções P1 admin/dashboard | Médio | Pendente — Loop 3E |
| 2 funções P2 lookup | Baixo | Backlog |
| Webhooks sem validação de signature confirmada | A confirmar | Auditoria P3 separada |
| Cron sem secret-gate confirmado | A confirmar | Auditoria P4 separada |
| Linter remanescente: `Extension in Public` (2) | Baixo | Pré-existente, fora de escopo |
| Linter remanescente: `RLS Policy Always True` (várias) | Médio | Pré-existente, requer análise por política — não é hotfix |
| Linter remanescente: Auth OTP / leaked password / Postgres version | Baixo-Médio | Configuração de projeto, requer ação manual no painel Cloud |

---

## 5. Confirmação de Escopo Estrito

- ❌ Nenhum arquivo em `src/` modificado
- ❌ Nenhuma Edge Function modificada
- ❌ Nenhum algoritmo pedagógico tocado
- ❌ Nenhuma UI alterada
- ✅ Apenas `ALTER VIEW` e `ALTER FUNCTION` no banco
- ✅ Apenas documentação criada/atualizada

---

## 6. Próximo Loop Recomendado

**Loop 3E — Migração Edge Functions P0+P1 para `handleStandardEdgeFunction`**
Escopo: 11 funções (7 P0 + 4 P1). Sem mudar payload, sem mudar resposta — apenas substituir o handler manual pelo wrapper que faz `getClaims`.
