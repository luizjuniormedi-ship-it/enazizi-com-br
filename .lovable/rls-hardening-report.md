# RLS Hardening Report — Fechamento Final

## Antes
- 35+ policies com `USING (true)` / `WITH CHECK (true)` aplicadas ao role `public`.
- Várias nomeadas "Admins/Workers/Service role" mas **sem checagem real** — qualquer authenticated lia/escrevia.

## Classificação por risco

| Risco | Tabelas | Motivo |
|------|---------|--------|
| 🔴 CRÍTICO | `cme_timeline_clips`, `cme_timeline_tracks`, `ai_video_lessons`, `cme_video_assets`, `cme_voice_assets`, `cme_narrative_scripts`, `cme_semantic_plans`, `exam_blueprints`, `exam_blueprint_versions`, `cme_governance_logs`, `cme_governance_reviews`, `cme_reference_uploads`, `cme_playback_hotspots` | ALL/INSERT/UPDATE/DELETE liberado a qualquer authenticated; conteúdo curatorial/pedagógico |
| 🟠 ALTO | `cme_render_chunks`, `cme_gpu_workers`, `cme_render_failures` | Infra de renderização; só service_role/admin deveriam tocar |
| 🟡 MÉDIO | `ai_content_audit_logs`, `governance_logs` (INSERT) | Permitia spam de logs por anon |
| 🟢 OK (intencional) | `cme_pipeline_events`, `knowledge_edges`, `knowledge_graph_nodes`, `intervention_policies`, `cme_tutor_origins` (SELECT public) | Conteúdo público de leitura |

## Depois (corrigido)

| Tabela | Policy nova | Quem pode escrever |
|--------|-------------|--------------------|
| Todas críticas CME | `admins_manage_<t>` | `has_role(auth.uid(),'admin')` |
| `exam_blueprints*` | `staff_manage_…` | admin OU professor |
| `ai_video_lessons` | `Admins manage ai_video_lessons` | admin |
| `cme_gpu_workers/render_chunks/render_failures` | `service_role_manages_…` + `admins_view_…` | service_role escreve, admin lê |
| `mnemonic_agent_logs` | `service_role_manages_…` + `admins_view_…` | service_role escreve, admin lê |
| `ai_content_audit_logs`, `governance_logs` | `auth_insert_…` | qualquer authenticated (não-anon) |

## Verificação final
```
public_writes_remaining (qual=true, role=public, sem service_role): 0
service_role_only (intencional, bypassa RLS):                        57
public_select (leituras públicas legítimas):                         15
```
Linter total: 168 → 167 warnings restantes — todos pattern `USING(true)` em policies `service_role` (não exploitable; service_role já bypassa RLS pelo próprio mecanismo de chave).

## Não foi alterado
- Lógica pedagógica, payloads, prompts, FSRS/TRI.
- Policies de tabelas de usuário (`profiles`, `practice_attempts`, `error_bank`, `fsrs_cards`, etc.) já estavam corretas.
