import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTutorBlock, type TutorBlock } from "@/types/tutor";

/**
 * useTutorStream — Sprint 4 (dual mode)
 *
 * Mantém todo o comportamento da Sprint 3 para `format: "markdown"` (default),
 * e adiciona suporte opt-in para `format: "blocks"` (NDJSON, 1 TutorBlock por linha).
 *
 * Regras de compatibilidade:
 *  - Sem `format` → markdown (idêntico ao V1).
 *  - format="blocks" + payload inválido → tolerado, ignorado silenciosamente.
 *  - format="blocks" mas backend retorna texto cru → fallback automático para
 *    onDelta() acumulando como markdown (consumer pode embrulhar em deep_dive).
 */

export type TutorStreamFormat = "markdown" | "blocks";

export interface StreamErrorInfo {
  status?: number;
  message: string;
}

export interface StreamResponseOptions {
  url: string;
  body: Record<string, unknown>;
  /** Formato esperado da resposta. Default: "markdown" (compatibilidade V1). */
  format?: TutorStreamFormat;
  /** Optional signal for aborting the fetch. */
  signal?: AbortSignal;
  /** Called once when the first non-empty delta arrives. */
  onFirstChunk?: () => void;
  /** Called on every flushed delta with the FULL accumulated text so far. */
  onDelta: (fullText: string) => void;
  /** Called when a valid TutorBlock is parsed (only in format="blocks"). */
  onBlock?: (block: TutorBlock) => void;
  /** Called once at the end with the final accumulated text. */
  onComplete?: (finalText: string) => void;
  /** Called on transport / HTTP error. */
  onError?: (err: StreamErrorInfo) => void;
}

export function useTutorStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        /* noop */
      }
      abortRef.current = null;
    }
  }, []);

  const streamResponse = useCallback(
    async ({
      url,
      body,
      format = "markdown",
      onFirstChunk,
      onDelta,
      onBlock,
      onComplete,
      onError,
      signal,
    }: StreamResponseOptions): Promise<{ content: string; metrics?: any } | null> => {
      abortStream();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      let assistantSoFar = "";
      let lastFlushed = "";
      let pendingFlush = false;
      let firstChunkFired = false;

      const flushAssistant = () => {
        pendingFlush = false;
        if (assistantSoFar === lastFlushed) return;
        lastFlushed = assistantSoFar;
        onDelta(assistantSoFar);
      };

      const scheduleAssistantFlush = () => {
        if (pendingFlush) return;
        pendingFlush = true;
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(flushAssistant);
        } else {
          setTimeout(flushAssistant, 16);
        }
      };

      const appendAssistantChunk = (content: string) => {
        if (!content) return;
        if (!firstChunkFired) {
          firstChunkFired = true;
          onFirstChunk?.();
        }
        assistantSoFar += content;
        scheduleAssistantFlush();
      };

      // ── MARKDOWN MODE (V1 behavior) ──────────────────────────────────────
      const processSseLine = (rawLine: string): "ok" | "done" | "incomplete" => {
        let line = rawLine;
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") return "ok";
        if (!line.startsWith("data: ")) return "ok";
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return "done";
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            appendAssistantChunk(content);
            // DEBUG LOG para detectar blocos JSON chegando no stream
            if (content.includes('"type":')) {
              console.log("[useTutorStream] Detected potential JSON block in stream delta");
            }
          }
          return "ok";
        } catch {
          return "incomplete";
        }

      };

      // ── BLOCKS MODE (NDJSON, 1 TutorBlock por linha) ─────────────────────
      const processBlockLine = (rawLine: string): "ok" | "done" | "incomplete" => {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        const trimmed = line.trim();
        if (!trimmed) return "ok";
        if (trimmed === "[DONE]") return "done";
        try {
          const parsed = JSON.parse(trimmed);
          if (isTutorBlock(parsed)) {
            if (!firstChunkFired) {
              firstChunkFired = true;
              onFirstChunk?.();
            }
            onBlock?.(parsed);
            // Mantém um espelho textual para compat com onDelta consumers.
            const mirror =
              parsed.type === "deep_dive"
                ? parsed.payload.markdown
                : `[${parsed.type}]`;
            appendAssistantChunk((assistantSoFar ? "\n\n" : "") + mirror);
          }
          // Bloco inválido → tolerado, segue stream.
          return "ok";
        } catch {
          return "incomplete";
        }
      };

      const lineProcessor = format === "blocks" ? processBlockLine : processSseLine;

      // Helper: fetch with current session token. Used twice so we can
      // transparently refresh + retry on 401 (post-Sprint-1 hardening).
      const doFetch = async (token: string) => {
        const correlationId = (body.correlation_id as string) || (body.requestId as string) || crypto.randomUUID();
        
        // [TUTOR_V3_02_FUNCTION_NAME]
        console.log(`[TUTOR_V3_02_FUNCTION_NAME] function=${url}`);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-correlation-id": correlationId,
        };
        
        // [TUTOR_V3_03_SUPABASE_URL]
        console.log(`[TUTOR_V3_03_SUPABASE_URL] Requesting ${url}`, { correlationId, method: "POST" });
        
        try {
          // v13 HARDENING: Using standard fetch for streaming resilience
          const fetchResponse = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: signal || controller.signal,
            mode: 'cors',
            credentials: 'omit'
          });
          
          console.log(`[TUTOR_V3_07_INVOKE_DATA] Response status: ${fetchResponse.status}`);
          return fetchResponse;
        } catch (fetchErr: any) {
          console.error(`[TUTOR_V3_08_INVOKE_ERROR] Fetch failed immediately:`, fetchErr);
          throw fetchErr;
        }
      };

      const maxRetries = 2;
      let attempt = 0;

      const runFetch = async () => {
        attempt++;
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          let accessToken = session?.access_token;

          if (!accessToken) {
            throw new Error("Sua sessão expirou. Faça login novamente.");
          }

          let resp = await doFetch(accessToken);

          // 401 → try one silent refresh, then retry once.
          if (resp.status === 401) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            const refreshedToken = refreshed?.session?.access_token;
            if (refreshedToken) {
              accessToken = refreshedToken;
              resp = await doFetch(refreshedToken);
            }
          }

          if (!resp.ok) {
            if (resp.status >= 500 && attempt <= maxRetries) {
              console.warn(`[useTutorStream] Server error ${resp.status}, retrying attempt ${attempt}...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              return runFetch();
            }
            const errData = await resp.json().catch(() => ({}));
            const friendly =
              resp.status === 401
                ? "Sua sessão expirou. Faça login novamente."
                : (errData as { error?: string; message?: string }).message ||
                  (errData as { error?: string }).error ||
                  "stream_http_error";
            throw new Error(friendly);
          }
          return resp;
        } catch (e) {
          if (attempt <= maxRetries && !signal?.aborted) {
            console.warn(`[useTutorStream] Network error, retrying attempt ${attempt}...`, e);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            return runFetch();
          }
          throw e;
        }
      };

      try {
        const resp = await runFetch();
        if (!resp || !resp.body) throw new Error("No response body");

        const contentType = resp.headers.get("Content-Type") || "";
        const isJson = contentType.includes("application/json");

        if (isJson) {
          const data = await resp.json();
          console.log("[TUTOR_UI_RESPONSE_RAW] JSON:", data);
          // [TUTOR_07_INVOKE_RESPONSE_RAW]
          console.log(`[TUTOR_07_INVOKE_RESPONSE_RAW]`, data);
          
          // [TUTOR_22_FRONTEND_DATA_RECEIVED]
          console.log("[TUTOR_22_FRONTEND_DATA_RECEIVED] requestId=" + body.requestId, data);
          
          const content = data.content || data.message || data.answer || data.response || "";
          // [TUTOR_23_CONTENT_EXTRACTED]
          console.log(`[TUTOR_23_CONTENT_EXTRACTED] contentLen=${content?.length}`);

          if (!content && data.ok === false) {
            onError?.({ status: resp.status, message: data.message || "Erro na resposta da IA" });
            return null;
          }

          onFirstChunk?.();
          onDelta(content);
          onComplete?.(content);
          setIsStreaming(false);
          console.log("[TUTOR_V3_RESPONSE_SHAPE] JSON processed", { hasContent: !!content });
          return { content, metrics: data.metrics };
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            const line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            const result = lineProcessor(line);
            if (result === "done") {
              streamDone = true;
              break;
            }
            if (result === "incomplete") {
              textBuffer = `${line}\n${textBuffer}`;
              break;
            }
          }
        }

        textBuffer += decoder.decode();
        if (textBuffer.trim()) {
          const remainingLines = textBuffer.split("\n");
          for (const line of remainingLines) {
            if (!line) continue;
            const result = lineProcessor(line);
            if (result === "done") break;
          }
        }

        if (assistantSoFar !== lastFlushed) {
          lastFlushed = assistantSoFar;
          onDelta(assistantSoFar);
        }

        onComplete?.(assistantSoFar);
        return { content: assistantSoFar };
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") {
          return assistantSoFar ? { content: assistantSoFar } : null;
        }
        console.error("[useTutorStream] error:", e);
        // [TUTOR_08_INVOKE_ERROR_RAW]
        console.log(`[TUTOR_08_INVOKE_ERROR_RAW]`, e);
        
        const errorMessage = e instanceof Error ? e.message : "Erro de conexão com o Tutor";
        const isNetworkError = errorMessage.includes("Failed to fetch") || 
                              errorMessage.includes("Load failed") || 
                              errorMessage.includes("NetworkError");
                              
        onError?.({
          message: isNetworkError ? "Falha de rede ou CORS ao conectar com o Tutor IA. Verifique se o backend está ativo e sua conexão." : errorMessage,
        });
        return null;
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [abortStream]
  );

  return { streamResponse, abortStream, isStreaming };
}
