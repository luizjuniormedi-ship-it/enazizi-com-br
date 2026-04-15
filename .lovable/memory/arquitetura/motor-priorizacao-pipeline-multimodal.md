---
name: Motor de Priorização Inteligente do Pipeline Multimodal
description: Sistema de scoring e gap analysis para priorizar ingestão de assets por relevância de prova, fraqueza dos alunos e balanceamento do banco
type: feature
---

## Tabelas
- `import_priority_config`: configuração de rankings de diagnósticos por image_type (xray, ecg, ct, dermatology), pesos (exam 40%, weakness 35%, gap 25%), targets de dificuldade, min/max por diagnóstico
- `content_gap_reports`: snapshots de gap analysis com diagnósticos faltantes, saturados, e recomendação de próximo lote

## DB Function
- `compute_content_gaps(p_image_type)`: retorna total assets, questões, distribuição por diagnóstico e dificuldade

## Edge Function
- `plan-next-batch`: calcula lote priorizado por image_type usando score composto (exam_relevance × peso + gap × peso + weakness × peso)

## Fórmula de Prioridade (import_priority_score)
- **Exam score (0-100)**: exam_weight × 10 do ranking
- **Gap score (0-100)**: 100 se ausente, 80 se < min, 0 se saturado, +15 se dificuldade carente
- **Weakness score (0-100)**: (1 - avg_accuracy) × 100 dos visual_skill_snapshots
- **Composto**: exam × 0.40 + gap × 0.25 + weakness × 0.35

## Modos
- `exam_relevance`, `student_weakness`, `inventory_balance`, `hybrid`

## Integração
- `run-pipeline` usa `import_priority_config` para priorizar assets de diagnósticos top-ranked
- `PipelineOptimizationPanel` no Image Quiz mostra gap analysis e permite planejar próximo lote
- Client lib: `src/lib/importPrioritization.ts`

## Rankings Iniciais
- RX: Pneumonia, Derrame pleural, Pneumotórax, Atelectasia, Cardiomegalia, Edema pulmonar... (14 diagnósticos)
- ECG: Ritmo sinusal normal, Fibrilação atrial, Flutter atrial, BRD, BRE, BAV, TSV, Bradicardia, Isquemia, HVE... (14 diagnósticos)
