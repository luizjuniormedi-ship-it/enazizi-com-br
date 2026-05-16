# TUTOR IA & ENAZIZI MNEMONIC GENERATOR — OPENAI HARDENING

## Arquitetura Final
- **Modelos de Linguagem:** `openai/gpt-5-mini` (rápido, barato, preciso para medicina).
- **Modelos de Imagem:** `openai/gpt-5` (DALL-E 3 via API multimodal).
- **Hardening:** Bloqueio total de modelos Gemini/Google para evitar regressões de gateway e inconsistências de telemetria.

## Fluxo de Geração (ENAZIZI Definitivo)
1. **Entrada:** Tema + Subtema + Itens (opcional).
2. **Extração Automática:** Se itens vazios, IA extrai termos 1:1 baseados em incidência de prova.
3. **Normalização & Otimização:** Encurtamento de termos, remoção de redundâncias e itens genéricos.
4. **Geração 1:1:** 1 letra = 1 item. Cobertura total obrigatória.
5. **Auditoria Fail-Closed:** Resultados com score < 80 são rejeitados e sofrem auto-reparo (até 3 tentativas).
6. **Persistência & Telemetria:** Logs detalhados de cada agente e versão final salva no Supabase.

## Tabelas Envolvidas
- `mnemonic_requests`: Log de intenções.
- `mnemonic_results`: Ativos de mnemônicos (Assets).
- `user_mnemonic_links`: Vínculo usuário-mnemônico para sistema adaptativo.
- `mnemonic_agent_logs`: Telemetria e auditoria.

## Status de Verificação
- ✅ OpenAI Only
- ✅ RLS Configurado
- ✅ Auto-complete de Subtemas
- ✅ Sugestão de Itens Automática
- ✅ Fail-Closed Implementado
