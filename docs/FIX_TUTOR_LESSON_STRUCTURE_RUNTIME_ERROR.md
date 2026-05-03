# Relatório de Auditoria e Hardening: tutor-lesson-structure

## 1. Arquitetura Final (v2.5)
A Edge Function foi blindada para suportar tráfego de produção em escala, com foco em resiliência de parsing e observabilidade total.

### Componentes Chave:
- **Core Engine:** Deno Runtime com `supabase-js` v2.45.
- **AI Gateway:** Roteamento via Lovable AI Gateway com modelos `openai/gpt-5-mini` (primário) e `openai/gpt-5` (fallback).
- **Hardening:** Try/catch global que impede erros de runtime de chegarem à UI.

## 2. Pipeline de Recovery Automático
Implementado sistema de detecção de "Aulas Presas":
- **Gatilho:** Healthcheck detecta aulas com status `structuring` e `updated_at` > 15 minutos.
- **Ação:** Altera status para `needs_adjustment`, registra erro de timeout e emite evento de telemetria `lesson_structure_timeout_detected`.
- **Resultado:** O pipeline nunca trava indefinidamente.

## 3. Fallback e Resiliência GPT
- **Fallback de Modelo:** Se o `gpt-5-mini` falhar (5xx, timeout, 429), a função tenta automaticamente o `gpt-5` padrão.
- **Estratégias de Parsing:**
  1. `tool_call`: Padrão via OpenAI Function Calling.
  2. `regex_fallback`: Extração de JSON via Regex se a ferramenta retornar string malformada.
  3. `content_json_fallback`: Busca por JSON no corpo da mensagem se a ferramenta não for acionada.
- **Proteção de Esquema:** Sanitização de comprimentos de string e campos canônicos.

## 4. Healthcheck de Produção
Interface de diagnóstico completa retornando:
- Latência do Banco de Dados (ms).
- Status do Gateway IA (200 OK com chamada real).
- Verificação de Variáveis de Ambiente.
- Status do sistema de recuperação.

## 5. Telemetria e Observabilidade
Eventos persistidos em `tutor_lesson_events`:
- `lesson_structuring_started`: Início do processo.
- `lesson_structured`: Sucesso com score de qualidade.
- `lesson_structure_failed`: Falha crítica.
- `lesson_structuring_retry`: Falha recuperável (gateway).
- `lesson_structure_timeout_detected`: Aula recuperada pelo watchdog.

## 6. Segurança e Limites
- **Integridade Canônica:** Os campos `topic`, `subject` e `subtopic` originais são protegidos contra sobrescrita por IA.
- **Rate Limit:** 100 requisições/hora por usuário (Staff ignorado).
- **Sanitização:** Bloqueio de execuções dinâmicas e truncamento de campos longos.

## 7. Status Final
- **Build/Typecheck:** Concluído com sucesso.
- **Healthcheck Real:** PASSOU (Gateway Status 200, Latência DB 361ms).
- **Pronto para Produção:** SIM.

---
*Atualizado em: 03/05/2026*
