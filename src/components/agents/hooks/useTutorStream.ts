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
    }: StreamResponseOptions): Promise<string | null> => {
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
          if (content) appendAssistantChunk(content);
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
      const doFetch = async (token: string) =>
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let accessToken = session?.access_token;

        if (!accessToken) {
          onError?.({ status: 401, message: "Sua sessão expirou. Faça login novamente." });
          return null;
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
          const errData = await resp.json().catch(() => ({}));
          const friendly =
            resp.status === 401
              ? "Sua sessão expirou. Faça login novamente."
              : (errData as { error?: string; message?: string }).message ||
                (errData as { error?: string }).error ||
                "stream_http_error";
          onError?.({ status: resp.status, message: friendly });
          return null;
        }

        if (!resp.body) throw new Error("No response body");

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
        return assistantSoFar;
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") {
          return assistantSoFar || null;
        }
        console.error("[useTutorStream] error:", e);
        onError?.({
          message: e instanceof Error ? e.message : "stream_unknown_error",
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
