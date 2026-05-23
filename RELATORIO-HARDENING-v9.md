# RELATÓRIO HARDENING v9 — ENAZIZI

## Status

Implementação local concluída e build validado.

> Observação crítica: o teste Playwright 10/10 foi criado, mas não foi executado contra produção nesta etapa porque as alterações locais ainda precisam ser deployadas para `https://enazizi.com` e as migrations/policies precisam ser aplicadas no Supabase remoto. Declarar console limpo em produção antes do deploy seria teatro barato — e inútil.

## Causa raiz real

As falhas intermitentes tinham múltiplas causas combinadas:

1. **CORS inconsistente em Edge Functions**
   - `enterpriseEdgeHandler` não anunciava `Access-Control-Allow-Methods`.
   - Algumas respostas manuais em `pedagogical-event-consumer`, `mentor-chat` e `study-complete` não incluíam `corsHeaders`.

2. **`pedagogical_events` com upsert instável**
   - Havia policy de `SELECT` e `INSERT`, mas não havia policy autenticada clara de `UPDATE`.
   - `upsert(... on_conflict=idempotency_key)` pode exigir `UPDATE` e visibilidade pós-operação.
   - O frontend fazia `.insert().select().single()`, aumentando chance de `406`/RLS/retorno bloqueado.

3. **Telemetria ainda podia competir com UX**
   - Alguns fluxos aguardavam `pedagogicalEventBus.emit()` antes de continuar.
   - Isso transformava analytics/eventos em ponto de falha de Tutor, Planner, Flashcards, Simulados e Mnemônicos.

4. **Mnemônico ainda podia terminar em erro funcional**
   - Falha de extração automática podia retornar 422.
   - Catch final ainda podia retornar HTTP 500.
   - Timeout global retornava 504.
   - Fallback existia, mas não cobria todos os caminhos fatais.

## Correções aplicadas

### 1. CORS definitivo

Arquivos alterados:

- `supabase/functions/_shared/enterprise-edge/enterprise-edge-handler.ts`
- `supabase/functions/generate-mnemonic/index.ts`
- `supabase/functions/pedagogical-event-consumer/index.ts`
- `supabase/functions/mentor-chat/index.ts`
- `supabase/functions/study-complete/index.ts`

Adicionado:

```ts
"Access-Control-Allow-Methods": "GET, POST, OPTIONS"
```

E respostas manuais passaram a incluir:

```ts
headers: { ...corsHeaders, "Content-Type": "application/json" }
```

### 2. RLS e upsert de `pedagogical_events`

Migration criada:

- `supabase/migrations/20260523192000_hardening_v9_pedagogical_events_rls.sql`

SQL aplicado/necessário:

```sql
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedagogical_events_select_own ON public.pedagogical_events;
DROP POLICY IF EXISTS pedagogical_events_insert_own ON public.pedagogical_events;
DROP POLICY IF EXISTS pedagogical_events_update_own ON public.pedagogical_events;

CREATE POLICY pedagogical_events_select_own
ON public.pedagogical_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY pedagogical_events_insert_own
ON public.pedagogical_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY pedagogical_events_update_own
ON public.pedagogical_events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pedagogical_events_idempotency_key
ON public.pedagogical_events (idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

Policies antigas conhecidas:

- `Users can view their own events` — SELECT
- `Users can insert their own events` — INSERT
- `Service role has full access` — ALL

Gap corrigido:

- policy autenticada de UPDATE para suportar upsert.

### 3. Telemetria desacoplada

Novo arquivo:

- `src/lib/safeTelemetry.ts`

Implementado:

```ts
safeTelemetry(fn, label)
safeTelemetryFireAndForget(fn, label)
```

Fluxos ajustados:

- `src/lib/pedagogicalEventBus.ts`
- `src/lib/studyEngineTelemetry.ts`
- `src/lib/approvalTelemetry.ts`
- `src/lib/shadowAdaptive.ts`
- `src/pages/Flashcards.tsx`
- `src/pages/TutorV2Page.tsx`
- `src/pages/SmartPlanner.tsx`
- `src/pages/QuestionsBank.tsx`
- `src/components/tutor-v2/TutorV2ChatPanel.tsx`
- `src/components/simulados/SimuladoExam.tsx`
- `src/pages/MnemonicStudioPage.tsx`

Mudança principal:

- chamadas `await pedagogicalEventBus.emit(...)` viraram `void pedagogicalEventBus.emit(...)`.
- `pedagogicalEventBus.emit()` agora usa `upsert` sem `.select().single()`.
- falhas geram `[TELEMETRY_SAFE_FAIL]`, mas não quebram UX.

### 4. Generate-mnemonic blindado

Arquivo:

- `supabase/functions/generate-mnemonic/index.ts`

Implementado:

- `Access-Control-Allow-Methods`.
- timeouts por tentativa:
  - Gemini: 25s
  - Anthropic fallback: 30s
- circuit breaker em memória:
  - `CLOSED`
  - `OPEN`
  - `HALF_OPEN`
  - abre após 5 falhas por 60s.
- fallback seguro para:
  - falha de extração de termos;
  - falha total da IA;
  - catch do pipeline;
  - timeout global;
  - fatal catch.

Garantia nova:

- `generate-mnemonic` não deve retornar HTTP 500/504 em falha operacional de IA; retorna `success: true` com fallback estático seguro.

Fallback estático para Critérios de Light:

```json
{
  "success": true,
  "data": {
    "fallback": true,
    "sigla": "LUZ",
    "frase_mnemonica": "A LUZ ilumina os critérios de Light.",
    "explicacao_didatica": "Os critérios de Light ajudam a diferenciar transudato e exsudato ao comparar proteína e LDH do líquido pleural com o soro.",
    "cena_visual": "Uma luz iluminando pulmões e líquidos pleurais para separar transudato de exsudato.",
    "score_final": 82
  }
}
```

### 5. Frontend auto=1 e render final

Arquivo:

- `src/pages/MnemonicStudioPage.tsx`

Implementado:

- `generationLockRef` para evitar corrida de geração.
- `hydrationReadyRef` para evitar auto-trigger antes de hidratação.
- debounce do auto-trigger ajustado para 500ms.
- logs:
  - `[MNEMONIC_START]`
  - `[MNEMONIC_SET_STATE]`
  - `[MNEMONIC_FINAL_RENDER]`
- data-testids:
  - `mnemonic-loading`
  - `mnemonic-error`
  - `mnemonic-result`
  - `mnemonic-phrase`
  - `mnemonic-sigla`
  - `mnemonic-association`

### 6. Playwright stress final

Arquivo criado:

- `C:\Users\User\Desktop\playwright-enazizi\teste-enazizi-stress-final.spec.js`

Cobre 10 execuções consecutivas:

- login
- dashboard
- planner
- tutor
- simulados
- flashcards
- mnemônicos
- mobile
- tablet
- reload
- redirect legado
- render final por `data-testid`
- captura HTTP 400/403/406/409/500/502/503/504
- captura CORS/net::ERR_FAILED/hydration
- screenshots por execução

Comando correto para listar/executar a partir desta sessão:

```bash
node -e "process.chdir('C:/Users/User/Desktop/playwright-enazizi'); require('child_process').execFileSync('npx', ['playwright','test','teste-enazizi-stress-final.spec.js','--headed'], {stdio:'inherit', shell:true})"
```

Comando normal no CMD dentro da pasta:

```cmd
cd "C:\Users\User\Desktop\playwright-enazizi"
npx playwright test teste-enazizi-stress-final.spec.js --headed
```

## Logs evidenciais implementados

- `[MNEMONIC_START]`
- `[MNEMONIC_SUCCESS]`
- `[MNEMONIC_FALLBACK]`
- `[MNEMONIC_TIMEOUT]`
- `[TELEMETRY_SAFE_FAIL]`
- `[SAFE_TELEMETRY]`
- `[UPSERT_OK]`
- `[EDGE_RETRY]`
- `[CIRCUIT_OPEN]`
- `[CIRCUIT_RECOVERED]`
- `[MNEMONIC_PARSER_OK]`
- `[MNEMONIC_SET_STATE]`
- `[MNEMONIC_FINAL_RENDER]`

## Validação local

### Build

Comando:

```bash
npm --prefix "C:\Users\User\AppData\Local\Temp\enazizi-com-br" run build
```

Resultado:

- `✓ built in 30.85s`
- PWA gerada.
- Sem erro de compilação.

Warnings não bloqueantes:

- Tailwind: `duration-[1200ms]` ambígua.
- Alguns chunks > 500 kB.
- Imports dinâmicos/estáticos compartilhados.

### Routes test

Comando:

```bash
npm --prefix "C:\Users\User\AppData\Local\Temp\enazizi-com-br" run test -- src/test/Routes.test.tsx
```

Resultado:

- `1 passed`
- `8 tests passed`

### Playwright stress file

Comando executado para listar:

```bash
node -e "process.chdir('C:/Users/User/Desktop/playwright-enazizi'); require('child_process').execFileSync('npx', ['playwright','test','teste-enazizi-stress-final.spec.js','--list'], {stdio:'inherit', shell:true})"
```

Resultado:

- 10 testes detectados em `teste-enazizi-stress-final.spec.js`.

## Próximo passo obrigatório para aprovação final real

1. Aplicar migrations no Supabase remoto:

```bash
supabase db push
```

2. Deployar Edge Functions alteradas:

```bash
supabase functions deploy generate-mnemonic
supabase functions deploy pedagogical-event-consumer
supabase functions deploy mentor-chat
supabase functions deploy study-complete
supabase functions deploy generate-daily-plan
```

3. Deployar frontend.

4. Executar:

```cmd
cd "C:\Users\User\Desktop\playwright-enazizi"
npx playwright test teste-enazizi-stress-final.spec.js --headed
```

## Critério de aprovação pós-deploy

Só considerar aprovado quando o Playwright real provar:

- 10/10 execuções passaram.
- zero HTTP 500.
- zero HTTP 406.
- zero HTTP 403.
- zero HTTP 409.
- zero CORS.
- zero `net::ERR_FAILED`.
- `mnemonic-phrase` visível.
- `mnemonic-sigla` visível.
- screenshots gerados.
- logs de sucesso/fallback/retry capturados quando aplicável.
