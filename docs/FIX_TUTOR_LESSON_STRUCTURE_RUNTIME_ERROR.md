# Correção Crítica: Erro Runtime tutor-lesson-structure

## 1. Causa Raiz
A Edge Function estava retornando erros não-JSON (crus) ou códigos de status HTTP sem um corpo estruturado que o frontend pudesse interpretar, resultando na mensagem genérica "returned a non-2xx status code" e potencial instabilidade na UI.

## 2. Blindagem Implementada
- **Resposta Estruturada Global**: Toda e qualquer falha agora é capturada por um `try/catch` global que retorna um JSON com `success: false` e `technical_reason`.
- **Validação de Ambiente**: Adicionada verificação rigorosa de segredos (`LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) antes de qualquer processamento.
- **Proteção Canônica**: O código foi modificado para realizar apenas `UPDATE` baseado no `lesson_id`. Os campos `topic`, `subject`, `subtopic`, `user_id` e `source_session_id` são **preservados**, e as sugestões da IA são salvas em `metadata.ai_suggested_*`.

## 3. Gestão de Status e Telemetria
- **Falha Suave**: Se a IA falhar (timeout ou gateway), a aula é marcada como `needs_adjustment` com o erro técnico registrado em `last_structuring_error`, permitindo reprocessamento manual.
- **Eventos de Auditoria**: Registra `lesson_structure_failed` ou `lesson_structuring_retry` com detalhes do modelo e status do gateway.

## 4. Melhorias no Frontend (Admin)
- **Interpretador de Resposta**: O `AdminLessonsMemory` agora verifica `data.success === false` e exibe o `technical_reason` no console, mantendo o usuário informado via Toast sem quebrar a tela.

## 5. Validação Técnica
- **Typecheck**: OK
- **Build**: OK
- **RLS**: Mantido via Service Role para persistência segura.

---
*Resultado: O fluxo de reestruturação agora é resiliente, auditável e não interfere na integridade dos dados originais.*
