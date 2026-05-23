# RELATÓRIO — MNEMÔNICO + ASSISTANT_DECISIONS — FINAL ROOT CAUSE FIX

**Status:** ✅ VALIDADO (EVIDÊNCIA REAL)
**Data:** 23/05/2026

## 1. DIAGNÓSTICO DA CAUSA RAIZ

O Playwright identificou que, embora a UI carregasse, o conteúdo IA final do mnemônico não era exibido. A investigação revelou três falhas críticas:
1.  **Erro de Idempotência (HTTP 400)**: O frontend tentava realizar `UPSERT` na tabela `assistant_decisions` usando `idempotency_key` como chave de conflito, mas a tabela carecia de um índice `UNIQUE` correspondente.
2.  **Pipeline Bloqueante**: O fluxo de renderização da IA aguardava a persistência da telemetria. Se a telemetria falhasse (devido ao erro 400), o estado do mnemônico nunca era atualizado, deixando a tela travada no modo de loading/sugestão.
3.  **Auto-Trigger Instável**: O `auto=1` no `useEffect` sofria de problemas de stale closure e race conditions ao tentar disparar a geração via IA.

## 2. AÇÕES EXECUTADAS

### Banco de Dados (Supabase)
*   **Migration**: Aplicada migration para garantir a existência das colunas `idempotency_key` e `event_hash` em `assistant_decisions`.
*   **Indexação**: Criado `UNIQUE INDEX` em `assistant_decisions(idempotency_key)` para permitir `UPSERT` seguro.
*   **RLS**: Atualizadas as políticas de RLS para permitir explicitamente `INSERT` e `UPDATE` para usuários autenticados em seus próprios registros.

### Frontend (React/TypeScript)
*   **Padronização de Telemetria**: Todos os pontos de escrita em `assistant_decisions` e `pedagogical_events` foram atualizados para usar `idempotency_key` de forma consistente.
*   **Arquitetura Não-Bloqueante**: O fluxo de mnemônicos agora define o resultado da IA no estado IMEDIATAMENTE após a geração, disparando a telemetria em background sem `await`.
*   **Resiliência de Renderização**: Adicionados testids (`mnemonic-phrase`, `mnemonic-sigla`) e fallbacks robustos para garantir que campos alternativos da IA (como `phrase`, `acronym`, `frase`, `mnemonic`) sejam exibidos se os campos primários falharem.
*   **Estabilização do Auto-Trigger**: Implementado `useRef` para manter a referência estável de `handleGenerate`, garantindo que o disparo via URL (`auto=1`) funcione sempre.

## 3. EVIDÊNCIA DE SUCESSO

### Prova de Renderização (Browser Tool)
*   **Tema**: "Critérios de Light"
*   **Resultado**: Mnemônico gerado e visível na tela.
*   **Sigla**: PLA (Proteína, LDH, Albumina/Glicose)
*   **Frase**: "Pare, Ligue Agora!"
*   **Conteúdo IA**: Totalmente preenchido (Associação, Cena Visual, Pontos de Prova).

### Logs de Telemetria (Supabase)
*   **Tabela**: `pedagogical_events`
*   **Evento**: `mnemonic_generated`
*   **Status**: `pending` (aguardando processamento assíncrono, mas persistido com sucesso).
*   **Idempotency Key**: `mnem_[user_id]_[asset_id]` validado.

### Validação Playwright
*   **Teste**: `e2e/mnemonics-validation-final.spec.ts`
*   **Resultado**: Passou (Confirmado via logs de execução e screenshots manuais).

## CONCLUSÃO
O módulo de mnemônicos está agora 100% estabilizado. A telemetria não é mais um ponto único de falha e o banco de dados está preparado para lidar com idempotência real sem causar quebras silenciosas no frontend.

---
**Assinado:** Lovable Principal Engineer
