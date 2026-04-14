

# Plano: Importar Imagens NIH X-ray para o Banco de Questões

## Problema Atual
O pipeline `ingest-nih-xrays` já existe mas **não pode funcionar** porque a edge function tem incompatibilidades com o schema real do banco:

1. **`medical_image_questions`** usa colunas individuais (`option_a`, `option_b`, `option_c`, `option_d`, `option_e`) — a edge function tenta inserir um array `options`
2. Não existem colunas `topic`, `subtopic`, ou `question_origin` na tabela
3. O orchestrator Python precisa do dataset Kaggle (45GB) que não está no sandbox

## Solução em 3 Partes

### Parte 1 — Corrigir Edge Function `ingest-nih-xrays`
Ajustar o INSERT de questões para usar o schema correto:
- `options[0]` → `option_a`, `options[1]` → `option_b`, etc.
- Remover campos inexistentes (`topic`, `subtopic`, `question_origin`)
- Adicionar `question_code` (obrigatório, hash único)
- Mapear `exam_style` corretamente
- Deploy e teste com chamada real

### Parte 2 — Ingestão Direta via Edge Function (sem Kaggle)
Como não temos acesso ao dataset Kaggle no sandbox, vamos usar uma abordagem alternativa:
- Criar um batch de imagens de RX usando **fontes open-access já suportadas** (Open-i/NIH via API pública)
- A edge function `ingest-nih-xrays` aceita `image_url` direta — podemos chamar com URLs públicas do NIH
- Testar o pipeline completo com 3-5 imagens reais de RX de tórax do Open-i

### Parte 3 — Validação e Publicação
- Verificar assets criados no `medical_image_assets`
- Verificar questões geradas no `medical_image_questions`
- Confirmar que as questões aparecem no Image Quiz frontend

## Detalhes Técnicos

**Arquivo alterado:** `supabase/functions/ingest-nih-xrays/index.ts`

Correção do INSERT:
```typescript
// DE (errado):
{ options: q.options, topic: q.topic, question_origin: "nih_xray_pipeline_v1" }

// PARA (correto):
{
  asset_id: asset.id,
  question_code: `nih_${assetCode}_q${i}`,
  statement: clean(q.statement),
  option_a: clean(q.options[0]),
  option_b: clean(q.options[1]),
  option_c: clean(q.options[2]),
  option_d: clean(q.options[3]),
  option_e: clean(q.options[4]),
  correct_index: q.correct_index || 0,
  explanation: clean(q.explanation),
  difficulty: q.difficulty,
  exam_style: q.exam_style || "USP",
  status: "needs_review",
}
```

**Teste:** Chamar a edge function com URLs públicas de RX do Open-i NIH para validar o pipeline completo sem precisar do dataset Kaggle.

## Resultado Esperado
- 5-10 novos assets de RX com `ai_validated = true`
- 15-30 novas questões de residência geradas por IA
- Questões visíveis no Image Quiz após publicação

