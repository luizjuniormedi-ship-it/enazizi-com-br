/**
 * EU (Claude Gateway) — Primary AI Client.
 *
 * Roteia todas as chamadas pelo Edge Function `eu-ai`, que agora é um proxy
 * Anthropic-nativo para o Claude Gateway do plano Max 50x (v2026-06 hardening):
 *  - Segredos (ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY) permanecem SEMPRE server-side.
 *  - Fallback interno: Claude Gateway → Railway → success:false (caller decide Supabase).
 *  - Interface pública mantida (tryEU / mapToEURequest / euToSupabaseResponse) para
 *    não quebrar `tutorClient` e demais chamadores.
 */
import { supabase } from "@/integrations/supabase/client";

const EU_TIMEOUT_MS = 60_000;

export interface EUResponse {
  message: string;
  provider?: string;
  fallback_used?: boolean;
  [key: string]: any;
}

/**
 * Chama o Edge Function `eu-ai` (proxy Claude Gateway).
 * Retorna null em qualquer falha para o caller cair no fallback tradicional.
 */
export async function tryEU<T = EUResponse>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EU_TIMEOUT_MS);

  try {
    console.log("🤖 [EU] Claude Gateway ▶", path);
    // Anexa o path lógico para telemetria (o backend ignora se não usar).
    const { data, error } = await supabase.functions.invoke("eu-ai", {
      body: { ...body, __path: path },
    });
    clearTimeout(timer);

    if (error) {
      console.warn(`🔄 [FALLBACK] EU invoke error: ${error.message}`);
      return null;
    }
    if (!data || (data as any).success === false) {
      console.warn("🔄 [FALLBACK] EU respondeu success:false — fallback Supabase.");
      return null;
    }

    // Normaliza para a forma esperada { message, provider, ... }
    const normalized: any = {
      message: (data as any).message ?? (data as any).content ?? (data as any).response ?? "",
      provider: (data as any).provider ?? "claude-gateway",
      model: (data as any).model,
      source: (data as any).source ?? "claude-gateway",
      ...data,
    };

    if (!normalized.message) {
      console.warn("🔄 [FALLBACK] EU respondeu sem conteúdo — fallback Supabase.");
      return null;
    }

    console.log("✅ [EU] Claude Gateway respondeu!", normalized.model || "");
    return normalized as T;
  } catch (err: any) {
    clearTimeout(timer);
    const reason = err?.name === "AbortError" ? "timeout" : err?.message || "erro";
    console.warn(`🔄 [FALLBACK] EU falhou (${reason}), usando Supabase...`);
    return null;
  }
}

/** Mapeia o nome da Edge Function alvo → payload compatível com o Claude Gateway. */
export function mapToEURequest(
  functionName: string,
  payload: any,
): { path: string; body: Record<string, unknown> } | null {
  switch (functionName) {
    case "tutor-v3-premium":
    case "tutor-v2-chat": {
      const messages = Array.isArray(payload?.messages) ? payload.messages : undefined;
      const message = payload?.message ?? payload?.prompt ?? "";
      if (!messages && !message) return null;
      return {
        path: "/api/v1/chat",
        body: {
          messages,
          message,
          topic: payload?.topic ?? payload?.newTopic ?? "Medicina",
          system: payload?.system ?? payload?.systemPrompt,
        },
      };
    }
    case "generate-flashcards":
      return {
        path: "/api/v1/flashcards/generate",
        body: {
          message: `Gere ${payload?.quantity ?? 10} flashcards de alta qualidade em pt-BR sobre "${payload?.topic ?? ""}", formato Q/A objetivo com bibliografia.`,
          topic: payload?.topic ?? "",
        },
      };
    case "generate-mnemonic":
      return {
        path: "/api/v1/mnemonic/generate",
        body: {
          message: `Crie um mnemônico brasileiro memorável para: ${payload?.tema ?? payload?.concept ?? ""}. Traga acrônimo + explicação linha a linha.`,
        },
      };
    case "plantao":
    case "clinical-simulation":
      return {
        path: "/api/v1/plantao",
        body: {
          message: payload?.scenario ?? payload?.message ?? "Inicie uma simulação de plantão de emergência.",
        },
      };
    case "question-generator":
    case "generate-adaptive-simulado":
      return {
        path: "/api/v1/questions/generate",
        body: {
          message: `Gere ${payload?.count ?? payload?.quantity ?? 10} questões estilo prova de residência em pt-BR sobre ${payload?.specialty ?? payload?.topic ?? ""}, com alternativas A-E e comentário fundamentado.`,
        },
      };
    default:
      return null;
  }
}

/** Constrói uma Response com o shape esperado pelo restante do app. */
export function euToSupabaseResponse(functionName: string, eu: EUResponse): Response {
  let body: Record<string, unknown>;
  switch (functionName) {
    case "tutor-v3-premium":
    case "tutor-v2-chat":
      body = {
        content: eu.message,
        response: eu.message,
        message: eu.message,
        provider: eu.provider ?? "claude-gateway",
        model: (eu as any).model,
        source: eu.source ?? "claude-gateway",
        success: true,
      };
      break;
    default:
      body = { ...eu, success: true, source: eu.source ?? "claude-gateway" };
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
