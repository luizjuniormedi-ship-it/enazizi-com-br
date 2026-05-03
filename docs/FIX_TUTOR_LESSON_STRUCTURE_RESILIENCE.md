# Relatório de Resiliência: Estruturação de Aulas Tutor IA

## 1. Causa Raiz dos Problemas Anteriores
- **Conflito de Unicidade:** A IA tentava "melhorar" o tema original (ex: "Pericardite" -> "Pericardite Aguda"). Como o banco possui uma restrição `UNIQUE(user_id, topic)`, se o usuário já tivesse uma aula com o novo nome, a inserção falhava.
- **Aulas Travadas:** Falhas no Gateway de IA (502/Timeout) deixavam as aulas no status `structuring` indefinidamente sem um mecanismo de timeout visual ou recuperação automática no frontend.

## 2. Implementação do Topic Canônico
- A função `tutor-lesson-structure` foi blindada. Agora, os campos `topic`, `subject` e `subtopic` originais são preservados integralmente.
- As sugestões da IA são armazenadas exclusivamente no objeto `metadata` (campos `ai_suggested_topic`, etc.), garantindo que a integridade referencial do banco nunca seja quebrada por variações semânticas da IA.

## 3. Auditoria e Telemetria
Cada ciclo de estruturação agora registra eventos detalhados na tabela `tutor_lesson_events`:
- **Eventos:** `lesson_structuring_started`, `lesson_structuring_retry`, `lesson_structured`, `lesson_structure_failed`.
- **Metadados Gravados:**
  - `model_used` (Gemini Pro vs Flash)
  - `fallback_used` (Booleano)
  - `duration_ms` (Tempo total de processamento)
  - `gateway_status` (Código HTTP retornado pelo Gateway)
  - `attempt_count` (Número da tentativa atual)
  - `original_topic` vs `ai_returned_topic`

## 4. Novo Painel de Controle (Admin)
Criado o painel **"Testes de Estruturação IA"** com:
- **Healthcheck em Tempo Real:** Valida conexão com Supabase, Gateway Lovable e disponibilidade dos modelos Gemini.
- **Detecção de Gargalos:** Monitora aulas presas em `structuring` por mais de 15 minutos.
- **Recuperação Automática:** Botão para reprocessar em lote todas as aulas com falha ou travadas.
- **Métricas de Performance:** Tempo médio de resposta e taxa de uso de fallback.

## 5. Estratégia de Fallback e Retry
- **Hierarquia de Modelos:** O sistema tenta primeiro `gemini-2.0-pro-exp-02-05` para máxima qualidade pedagógica.
- **Fallback Automático:** Em caso de erro (exceto 429), o sistema degrada graciosamente para `gemini-2.0-flash-exp` para garantir a entrega, registrando a ocorrência para auditoria.
- **Retry Lógico:** O painel Admin permite que falhas temporárias (502) sejam reprocessadas com um clique.

## 6. Testes de Resiliência Executados
- [x] **Unicidade:** IA retornou tema diferente, banco manteve o original. **PASSOU.**
- [x] **Timeout:** Aula forçada a ficar `structuring` foi detectada pelo painel como "Travada". **PASSOU.**
- [x] **Fallback:** Simulação de erro no Pro ativou o Flash com sucesso. **PASSOU.**
- [x] **Segurança:** Operações restritas ao `service_role` dentro da Edge Function, garantindo bypass de RLS apenas onde necessário. **PASSOU.**

---
**Status Final:** RESILIENTE
**Próximos Passos:** Monitorar `fallback_rate` no novo painel para ajustar prompts se a qualidade do Flash for insuficiente.
