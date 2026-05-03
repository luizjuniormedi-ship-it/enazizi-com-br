# Auditoria e Correção: Tutor Lesson Structure Runtime Error

## 1. Problema Identificado
O sistema de Curadoria de Aulas estava apresentando falhas críticas (502/500) ao tentar reestruturar aulas via IA.
O erro principal era:
`invalid model: google/gemini-2.0-flash-exp, allowed models: [openai`

## 2. Diagnóstico Técnico
- **Restrição de Gateway**: O Lovable AI Gateway para este projeto estava configurado para aceitar apenas modelos com o prefixo `openai/`.
- **Modelos Depreciados**: O código anterior tentava utilizar o `google/gemini-2.0-flash-exp`, que não era reconhecido ou permitido.
- **Cascata de Falhas**: A função `handleReprocessFailures` no frontend disparava múltiplas chamadas simultâneas, sobrecarregando o gateway com erros de modelo inválido.

## 3. Ações Tomadas
- **Migração para OpenAI**: Atualizada a lista de modelos para `["openai/gpt-4o-mini", "openai/gpt-4o"]`, garantindo compatibilidade canônica com o gateway.
- **Resiliência de Parsing**: Adicionado bloco `try-catch` no parsing de argumentos das ferramentas da IA para evitar crashes silenciosos em caso de retorno mal-formado.
- **Instrumentação de Logs**: Adicionados logs de versão (v2.1) e rastreamento de erros de parsing no console do Deno.
- **Healthcheck Atualizado**: A função de diagnóstico interno agora valida a disponibilidade dos modelos OpenAI em vez de Gemini.

## 4. Testes de Validação
- **Deploy**: Executado com sucesso.
- **Auditoria de Banco**: Verificadas falhas anteriores na tabela `tutor_lesson_events` que confirmavam a rejeição do modelo Gemini.
- **Proteção de Dados**: Confirmado que a função mantém a integridade do `topic`, `subject` e `subtopic` originais, salvando sugestões apenas em `metadata`.

## 5. Próximos Passos
- Monitorar a taxa de sucesso das novas chamadas via painel admin.
- Se necessário, habilitar modelos `google/` através de suporte ou configuração de gateway adicional se houver preferência por Gemini 2.0 futuramente.

---
**Status Final**: CORRIGIDO
**Modelo Ativo**: openai/gpt-4o-mini
