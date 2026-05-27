# Edge Function Contracts Layer

**CONTRACT_VERSION = "v1"**

Camada de estabilidade contratual para Edge Functions do ENAZIZI.

## Regra

Edge Functions **devem** importar helpers compartilhados via contratos versionados:

```ts
// ✅ Permitido
import { cleanQuestionText, parseAiJson } from "../_shared/contracts/parser.contract.ts";
import { aiFetch, getAiErrorMessage } from "../_shared/contracts/ai-fetch.contract.ts";
import { safeFallbackResponse } from "../_shared/contracts/telemetry.contract.ts";

// ❌ Proibido (frágil — quebra silenciosamente quando símbolos mudam)
import { cleanQuestionText } from "../_shared/ai-fetch.ts";
```

## Por quê?

Incidentes reais (`question-generator`, `generate-adaptive-simulado`) sofreram
`BOOT_ERROR` por importarem símbolos que foram silenciosamente removidos de
`_shared/ai-fetch.ts`. Os contratos garantem:

- Símbolos estáveis e auditáveis (shims defensivos quando necessário).
- Versão (`CONTRACT_VERSION`) para detectar drift.
- Fallback seguro padronizado.
- Linter (`scripts/check-edge-imports.ts`) bloqueia imports diretos novos.

## Telemetria padronizada

```
[EDGE_BOOT_OK] [EDGE_BOOT_FAIL]
[EDGE_AUTH_OK] [EDGE_AUTH_FAIL]
[EDGE_AI_START] [EDGE_AI_OK] [EDGE_AI_FAIL]
[EDGE_PARSE_OK] [EDGE_PARSE_FAIL]
[EDGE_RESPONSE_OK] [EDGE_RESPONSE_FAIL]
```
