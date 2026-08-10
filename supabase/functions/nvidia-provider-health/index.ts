// NVIDIA Provider Health — read-only, não ativa o provider em nenhum módulo.
// Retorna status do secret, catálogo real (/v1/models) e ping em 2 candidatos
// (FAST e REASONING). Nunca retorna nem loga a NVIDIA_API_KEY.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callNvidia,
  getNvidiaBaseUrl,
  isNvidiaEnabled,
  listNvidiaModels,
  NVIDIA_HEALTHCHECK_CANDIDATES,
  NVIDIA_MODEL_REGISTRY,
  NvidiaProviderError,
} from "../_shared/nvidia-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function pingModel(model: string) {
  const started = Date.now();
  try {
    const result = await callNvidia({
      model,
      messages: [{ role: "user", content: "ok" }],
      maxTokens: 8,
      temperature: 0,
      timeoutMs: 20_000,
    });
    return {
      model,
      status: result.content.trim().length > 0 ? "WORKING" : "DEGRADED",
      http: 200,
      latencyMs: result.latencyMs,
      errorCode: null as string | null,
    };
  } catch (err) {
    const e = err as NvidiaProviderError;
    return {
      model,
      status: e?.code === "circuit_open" ? "DEGRADED" : "BROKEN",
      http: e?.httpStatus ?? null,
      latencyMs: e?.latencyMs ?? Date.now() - started,
      errorCode: e?.code ?? "unknown_error",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Mesmo padrão dos healthchecks do projeto: exige chamada autenticada.
  if (!req.headers.get("authorization")) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!isNvidiaEnabled()) {
    return json({
      provider: "nvidia",
      status: "not_configured",
      enabled: false,
      baseUrl: getNvidiaBaseUrl(),
      message: "NVIDIA_API_KEY MISSING — provider preparado e desabilitado.",
      candidates: NVIDIA_HEALTHCHECK_CANDIDATES,
      checkedAt: new Date().toISOString(),
    }, 200);
  }

  const catalog = await listNvidiaModels({ timeoutMs: 20_000 });
  const available = new Set(catalog.models);

  const candidates = [
    NVIDIA_MODEL_REGISTRY.fast.id,
    NVIDIA_MODEL_REGISTRY.reasoning.id,
  ].filter((id) => !catalog.ok || available.size === 0 || available.has(id));

  const results = [];
  for (const model of candidates) {
    results.push(await pingModel(model));
  }

  const anyWorking = results.some((r) => r.status === "WORKING");

  return json({
    provider: "nvidia",
    status: anyWorking ? "healthy" : results.length === 0 ? "no_candidates" : "unhealthy",
    enabled: true,
    baseUrl: getNvidiaBaseUrl(),
    catalog: {
      reachable: catalog.ok,
      httpStatus: catalog.httpStatus,
      count: catalog.models.length,
      sample: catalog.models.slice(0, 25),
    },
    tiers: {
      FAST: NVIDIA_MODEL_REGISTRY.fast.id,
      REASONING: NVIDIA_MODEL_REGISTRY.reasoning.id,
    },
    results,
    activatedInProductionModules: false,
    checkedAt: new Date().toISOString(),
  });
});
