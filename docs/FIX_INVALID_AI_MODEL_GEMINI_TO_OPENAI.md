# Relatório de Correção: Transição Global de Modelos Gemini para OpenAI (v2.7)

## 1. Problema Identificado
Todas as gerações de conteúdo falhavam com o erro:
`invalid model: google/gemini-2.0-flash-exp, allowed models: [openai...]`

A causa raiz era a persistência de referências a modelos Gemini em diversos pontos do sistema, incluindo fallbacks, arquivos compartilhados e configurações de tier de modelo, que não eram mais aceitos pelo Lovable AI Gateway neste projeto.

## 2. Ações Realizadas (Fase Final: Hardening)

### 2.1 Gemini Guard (Proteção Permanente)
- Implementado o `Gemini Guard` em `tutor-lesson-structure`.
- Qualquer tentativa de usar modelos contendo "gemini" ou "google/" dispara um erro crítico em tempo de execução, impedindo regressões acidentais.
- Adicionado `guard_status: "passed"` na telemetria de cada estruturação.

### 2.2 Telemetria do Modelo no Admin
- O `TutorLessonStructureDashboard` agora exibe:
  - Modelo real utilizado (`openai/gpt-5-mini` ou `openai/gpt-5`).
  - Taxa de fallback entre modelos.
  - Duração média das chamadas.
  - Status do healthcheck detalhado.

### 2.3 Limpeza de Labels (UI/UX)
- Substituídas todas as referências "Gemini" por termos amigáveis:
  - "Prompt Gemini" → "Prompt Vídeo Cinematográfico".
  - "Vídeo GPT-5" → "Vídeo Cinematográfico".
  - "Rastreabilidade Gemini" → "Rastreabilidade OpenAI".
- Formato de exportação renomeado internamente de `gemini` para `cinematic`.

### 2.4 Correção de Edge Functions Secundárias
- `generate-content-ai` foi totalmente migrado para o Lovable AI Gateway usando `openai/gpt-5-mini`, eliminando chamadas diretas obsoletas para a Google API.
- Corrigidos comentários e logs em: `vision-gate.ts`, `extract-exam-visual`, `process-docx-questions`, `validate-medical-image-ai`, `validate-image-assets` e `trajectory-explain-v1`.

## 3. Resultados de Testes

### 3.1 Healthcheck Consolidado
Executado em `tutor-lesson-structure`:
```json
{
  "success": true,
  "ok": true,
  "primary_model": "openai/gpt-5-mini",
  "fallback_model": "openai/gpt-5",
  "gemini_guard_status": "active",
  "forbidden_models_found": false,
  "gateway_status": 200
}
```

### 3.2 Regression Suite
- **Estruturação:** OK (Hepatites Agudas, Pericardite).
- **Exportação Cinematic:** OK.
- **Auditoria de Imagem:** OK (Vision via OpenAI).
- **Geração de Conteúdo:** OK (Master Library).

## 4. Status Final
- **Build/Typecheck:** OK
- **Segurança:** Gemini Guard Ativo
- **Observabilidade:** Telemetria completa no Admin
- **Status da Função:** Blindada (Production Hardened v2.7)

---
*Gerado em 03/05/2026*
