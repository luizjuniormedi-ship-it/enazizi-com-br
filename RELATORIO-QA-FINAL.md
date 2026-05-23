# RELATORIO-QA-FINAL — ENAZIZI BUGFIX WAVE v3

## 1. Mnemônico auto=1 NÃO gera conteúdo IA real
- **Causa Raiz**: O `useEffect` responsável pelo auto-trigger possuía dependências voláteis e uma lógica de proteção contra race conditions que impedia o disparo correto após o preenchimento do tema via URL.
- **Correção**: Implementação de `autoTriggeredRef` para garantir disparo único, sincronização direta com `searchParams` e remoção de redundâncias de state hydration.
- **Arquivos Alterados**: `src/pages/MnemonicStudioPage.tsx`
- **Status**: ✅ CORRIGIDO

## 2. assistant_decisions gerando HTTP 409
- **Causa Raiz**: Tentativas de inserção duplicada em tabelas com chaves de idempotência baseadas em `user_id` e `event_hash` sem o uso correto de `upsert` com `onConflict`.
- **Correção**: Adição da coluna `idempotency_key` via migração SQL. Atualização global de todos os pontos de persistência para usar `.upsert()` com `onConflict: 'idempotency_key'`.
- **Arquivos Alterados**: `src/lib/studyEngineTelemetry.ts`, `src/lib/shadowAdaptive.ts`, `src/lib/approvalTelemetry.ts`, migração SQL.
- **Status**: ✅ CORRIGIDO

## 3. CORS em module_sessions
- **Causa Raiz**: Chamadas `fetch` durante o evento `beforeunload` estavam usando `credentials: 'include'`, o que conflita com a política de CORS do Supabase (Wildcard Origin).
- **Correção**: Padronização para `credentials: 'omit'` e `keepalive: true` em todas as chamadas de persistência de sessão.
- **Arquivos Alterados**: `src/hooks/useSessionPersistence.ts`
- **Status**: ✅ CORRIGIDO

## 4. profiles continua HTTP 400
- **Causa Raiz**: Ausência das colunas `notifications_enabled` e `study_reminders` no schema da tabela `profiles` em produção, causando falha no `SELECT`.
- **Correção**: Execução de migração SQL `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS...`.
- **Arquivos Alterados**: Migração SQL.
- **Status**: ✅ CORRIGIDO

## 5. Mobile net::ERR_ABORTED em sessao-estudo
- **Causa Raiz**: Loop de redirecionamento ou criação concorrente de sessões durante a hidratação do componente em dispositivos móveis, disparando múltiplas navegações simultâneas.
- **Correção**: Implementação de `creatingSessionRef` (Ref guard) e travamento de idempotência na função `handleStartSession`.
- **Arquivos Alterados**: `src/pages/TutorV2Page.tsx`
- **Status**: ✅ CORRIGIDO

## 6. UX e Warnings Críticos
- **Correção**: Adicionado `autoComplete` em formulários de autenticação (`ResetPassword.tsx`) e verificado `Login/Register`.
- **Arquivos Alterados**: `src/pages/ResetPassword.tsx`
- **Status**: ✅ CORRIGIDO

---
**VALIDACAO FINAL**: `npm run build` passou com sucesso. O sistema está estável para execução do Playwright.
