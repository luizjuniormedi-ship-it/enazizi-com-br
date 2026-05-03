# Robustez da Estruturação de Aulas do Tutor IA

## Resumo da Causa Raiz
O erro de unicidade (`duplicate key value violates unique constraint "tutor_lesson_memory_user_id_topic_key"`) ocorria porque a IA alterava o `topic` original para algo mais detalhado. Como o banco exige que `(user_id, topic)` seja único, ao mudar "Pericardite" para "Pericardite Aguda", se o usuário já tivesse uma aula com esse tema exato, a transação falhava, deixando a aula original travada no status `structuring`.

## Implementações de Segurança

### 1. Proteção de Campos Canônicos
A Edge Function `tutor-lesson-structure` agora protege explicitamente os campos:
- `id`, `user_id`, `source_session_id`, `topic`, `subject`.
- Se a IA sugerir um tema diferente, ele é salvo em `metadata.ai_suggested_topic` mas o campo principal `topic` permanece intacto.

### 2. Normalização Segura
- Criada coluna `topic_normalized` via migração SQL.
- Trigger Postgres `tr_tutor_lesson_normalize_topic` garante que buscas por temas funcionem independente de acentos ou caixa, sem alterar o dado original exibido ao usuário.

### 3. Recuperação de Aulas Travadas (Stuck)
- **Timeouts:** Aulas em `structuring` há mais de 15 minutos são detectadas como "travadas".
- **Painel Admin:** Adicionado contador e botão "Reprocessar Falhas" que identifica aulas travadas ou com erro e reinicia o fluxo automaticamente.
- **Healthcheck:** Endpoint dedicado na Edge Function para validar conectividade com DB e Gateway IA em tempo real.

## Logs e Rastreabilidade
Eventos registrados na tabela `tutor_lesson_events`:
- `lesson_structuring_started` (com `original_topic`)
- `lesson_structured` (com `model_used`, `fallback_used` e `duration_ms`)
- `lesson_structure_failed` (com mensagem de erro detalhada)

## Testes Executados
1. **Divergência de Tema:** Simulado aula com "Pericardite" onde IA retornou "Pericardite Aguda". Resultado: Topic mantido, sugestão salva em metadata.
2. **Gateway Error:** Simulado erro 502. Resultado: Retry automático e fallback para Gemini Flash bem-sucedido.
3. **Recuperação Manual:** Botão "Reprocessar" no Admin testado com sucesso em aulas com `last_structuring_error`.

## Próximos Passos
- Monitorar a taxa de reuso das aulas estruturadas via `pedagogical_quality_score`.
- Expandir o Healthcheck para incluir latência média da IA.
