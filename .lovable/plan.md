# Diagnóstico BOOT_ERROR — tutor-v2-chat (somente leitura)

## Evidência coletada

Smoke real em produção (`qszsyskumcmuknumwxtk`), 2026-08-16 13:14:56 UTC:

```text
POST /functions/v1/tutor-v2-chat  -> HTTP 503
sb-error-code: BOOT_ERROR
sb-request-id: 01a00ab6-0525-7b49-b038-08ce53377dc1
body: {"code":"BOOT_ERROR","message":"Function failed to start (please check logs)"}
OPTIONS /functions/v1/tutor-v2-chat -> HTTP 503 (falha antes do handler CORS)
```

Logs: as consultas de log/analytics para `tutor-v2-chat` retornaram vazio (`function_logs` e `function_edge_logs` sem linhas) — o worker morre antes de emitir log, então não há stack trace do runtime disponível. A falha ocorre também no OPTIONS, o que confirma erro de módulo/boot, não de runtime do handler.

## Reprodução local do módulo canônico

- `deno run -A --check=none supabase/functions/tutor-v2-chat/index.ts` → **boota com sucesso** ("Listening on http://localhost:8000/"). Todos os 9 imports (`require-auth`, `enazizi-prompt`, `ai-runtime-orchestrator`, `knowledge-cache`, `tutor-memory`, `injection-guard`, `cors`) resolvem e exportam os símbolos usados.
- `deno check` acusa apenas 3 erros de **tipo** (não bloqueiam boot no edge-runtime, que não faz typecheck):
  - `_shared/ai-runtime-orchestrator.ts:646` e `:647` — `result.success` não existe em `Omit<AIRunResult,"selection">`
  - `tutor-v2-chat/index.ts:203` — `auth.userId` acessado antes do narrowing `if (!auth.ok)` (só existe no ramo `ok: true`)

Conclusão factual: o código canônico atual **não** contém erro de import/sintaxe capaz de causar BOOT_ERROR. O artefato publicado em produção é uma versão anterior (stale) — `tutor-v2-chat` não foi reimplantado após as mudanças recentes em `_shared/ai-runtime-orchestrator.ts` (commits `630c64b6`, `94cc074f`), enquanto `tutor-v3-premium` foi. Diagnóstico da causa exata do bundle antigo permanece **não confirmado** por ausência de logs.

## Correção mínima (não executada)

1. Reimplantar somente a Edge Function existente `tutor-v2-chat` no ref `qszsyskumcmuknumwxtk`, preservando `verify_jwt = false` (linha 82-83 de `supabase/config.toml`). Nenhum arquivo novo, nenhuma rota nova.
2. Se após o redeploy o BOOT_ERROR persistir, aí sim aplicar a única correção de arquivo canônico necessária, em `supabase/functions/tutor-v2-chat/index.ts` linha 203: mover o log `[TUTOR_V2_AUTH_STATUS]` para depois de `if (!auth.ok) return auth.response;` (ou logar apenas `auth.ok`), eliminando o acesso a `auth.userId` no tipo sem essa propriedade.
3. Validação: `OPTIONS` deve responder 200 e `POST` sem Authorization deve responder 401 (não 503), com `sb-error-code` ausente.

Nada acima foi executado: nenhum deploy, nenhuma edição de código, nenhuma mudança de secret/configuração.
