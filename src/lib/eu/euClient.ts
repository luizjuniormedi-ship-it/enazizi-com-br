/**
 * EU (Claude via Railway) - Primary AI Client
 * Tries Railway API first, callers handle Supabase fallback on null.
 */
const EU_BASE_URL = "https://enazizi-com-br-production.up.railway.app";
const EU_TIMEOUT_MS = 60_000;

export interface EUResponse {
  message: string;
  provider?: string;
  fallback_used?: boolean;
  [key: string]: any;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = EU_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Try to call the EU (Claude/Railway) API. Returns null on any failure
 * so the caller can fallback to Supabase transparently.
 */
export async function tryEU<T = EUResponse>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const url = `${EU_BASE_URL}${path}`;
  try {
    console.log("🤖 [EU] Tentando Claude via Railway...", path);
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.warn(`🔄 [FALLBACK] EU respondeu ${resp.status}, usando Supabase...`);
      return null;
    }

    const data = (await resp.json()) as T;
    console.log("✅ [EU] Claude respondeu!", path);
    return data;
  } catch (err: any) {
    const reason = err?.name === "AbortError" ? "timeout" : (err?.message || "erro");
    console.warn(`🔄 [FALLBACK] EU falhou (${reason}), usando Supabase...`);
    return null;
  }
}

/** Map an internal Edge Function name → EU endpoint + body transformer. */
export function mapToEURequest(
  functionName: string,
  payload: any,
): { path: string; body: Record<string, unknown> } | null {
  switch (functionName) {
    case "tutor-v3-premium":
    case "tutor-v2-chat": {
      const message = payload?.message ?? payload?.prompt ?? "";
      if (!message) return null;
      return { path: "/api/v1/chat", body: { message, topic: payload?.topic ?? payload?.newTopic ?? "Medicina" } };
    }
    case "generate-flashcards":
      return { path: "/api/v1/flashcards/generate", body: { topic: payload?.topic ?? "", count: payload?.quantity ?? 10 } };
    case "generate-mnemonic":
      return { path: "/api/v1/mnemonic/generate", body: { concept: payload?.tema ?? payload?.concept ?? "" } };
    case "plantao":
    case "clinical-simulation":
      return { path: "/api/v1/plantao", body: { scenario: payload?.scenario ?? payload?.message ?? "" } };
    case "question-generator":
    case "generate-adaptive-simulado":
      return { path: "/api/v1/questions/generate", body: { specialty: payload?.specialty ?? payload?.topic ?? "", count: payload?.count ?? payload?.quantity ?? 10 } };
    default:
      return null;
  }
}

/** Build a Response that mimics the Supabase Edge Function shape from an EU payload. */
export function euToSupabaseResponse(functionName: string, eu: EUResponse): Response {
  let body: Record<string, unknown>;
  switch (functionName) {
    case "tutor-v3-premium":
    case "tutor-v2-chat":
      body = {
        content: eu.message,
        response: eu.message,
        provider: eu.provider ?? "claude",
        source: "eu-railway",
        success: true,
      };
      break;
    default:
      body = { ...eu, success: true, source: "eu-railway" };
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
