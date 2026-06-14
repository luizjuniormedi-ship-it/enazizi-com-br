# Tutor V3 Premium Benchmark — Latest

> Placeholder. Será sobrescrito pelo script `scripts/perf/benchmark-tutor-v3-premium.ts` na primeira execução com `USER_JWT` disponível.

## Como gerar

```bash
USER_JWT=<jwt> SUPABASE_PUBLISHABLE_KEY=<anon> \
  deno run --allow-net --allow-env --allow-write \
  scripts/perf/benchmark-tutor-v3-premium.ts
```

Variáveis opcionais:

- `TUTOR_FUNCTION_URL` ou `SUPABASE_FUNCTIONS_URL`
- `TUTOR_BENCH_RUNS` (default 5)

## Conteúdo esperado

- Sumário (data, função, URL, scenarios, runs).
- Tabela por cenário com avg/p50/p95/p99/min/max/avgAiMs/fallback%/timeout%/avgInputChars/trimmed%.
- Findings (cold vs warm, cenário mais lento, AI-dominant, fallback alto, timeouts, trimming).
- Recommendation: `PROVIDER_LATENCY_DOMINANT` | `CONTEXT_STILL_TOO_LARGE` | `COLD_START_DOMINANT` | `SUPABASE_OVERHEAD_DOMINANT` | `READY_FOR_NEXT_FUNCTION`.
