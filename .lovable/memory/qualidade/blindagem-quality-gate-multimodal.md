---
name: Blindagem Quality Gate Multimodal
description: Campo quality_gate_passed obrigatório em medical_image_assets; asset_quality_audit_logs registra cada aprovação/rejeição. Pipeline, geração de questões e frontend só aceitam quality_gate_passed=true.
type: feature
---

## Campo quality_gate_passed
- `medical_image_assets.quality_gate_passed` (boolean, default false)
- `medical_image_assets.rejection_reason` (text)
- Somente assets com `quality_gate_passed = true` podem: entrar na priorização, gerar questões, aparecer no quiz

## Tabela asset_quality_audit_logs
- asset_id, status (approved/rejected), rejection_reason, visual_quality_score, clinical_match_score, gate_source, details, created_at
- RLS: read-only para authenticated, writes via service_role

## Fluxo do Gate
1. Asset ingerido → validate-medical-image-ai (URL check + AI vision)
2. Se aprovado → quality_gate_passed = true, log "approved"
3. Se rejeitado → is_active = false, quality_gate_passed = false, log "rejected", questões movidas para draft

## Pontos de Bloqueio
- `run-pipeline`: .eq("quality_gate_passed", true)
- `generate-image-questions-secure`: .eq("quality_gate_passed", true) + diagnóstico obrigatório
- `plan-next-batch`: só conta assets quality_gate_passed
- Frontend: isRenderableMedicalImage() verifica quality_gate_passed !== false

## URL Blocklist
30+ termos bloqueados (logo, laptop, stock, placeholder, screenshot, portrait, etc.)

## Auditoria Retroativa
- `validate-medical-image-ai` aceita `{ audit: true }` para auditar todos os assets ativos
