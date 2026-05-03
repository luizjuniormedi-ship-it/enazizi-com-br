# Relatório de Configuração: Sistema Híbrido OpenAI + Gemini (v2.8)

## 1. Contexto
Após a migração total para OpenAI devido a restrições de gateway, o usuário solicitou a reativação do suporte ao Gemini para permitir redundância e uso de modelos específicos de acordo com a tarefa.

## 2. Ações Realizadas (Reativação Gemini)

### 2.1 Desativação do Gemini Guard
- O `Gemini Guard` em `tutor-lesson-structure` foi desativado.
- Removido o bloqueio de runtime para modelos `google/` e `gemini`.

### 2.2 Reativação no Tiering Global
- Arquivo `supabase/functions/_shared/ai-model-tier.ts` atualizado:
  - `lite`: `google/gemini-2.0-flash-exp` (Reativado)
  - `standard`: `google/gemini-2.0-flash-exp` (Reativado)
  - `pro`: `openai/gpt-5` (Mantido para tarefas críticas)

### 2.3 Estrutura de Aulas (tutor-lesson-structure)
- Modelo primário alterado para `google/gemini-2.0-flash-exp`.
- Fallback configurado na ordem:
  1. `google/gemini-2.0-flash-exp`
  2. `openai/gpt-5-mini`
  3. `openai/gpt-5`

## 3. Validação (Healthcheck)
O healthcheck agora valida a conectividade com o modelo Gemini via Lovable AI Gateway.
Status: **OK** (Gateway respondendo 200 para Gemini).

## 4. Próximos Passos
Monitorar a taxa de sucesso do Gemini no gateway. Caso o erro `invalid model` retorne, o sistema fará fallback automático para OpenAI sem interromper a experiência do usuário.

---
*Gerado em 03/05/2026*
