import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * useTutorStream — Sprint 3
 *
 * Encapsulates the SSE streaming pipeline used by the Tutor IA chat:
 *  - HTTP POST with Bearer token + apikey
 *  - reader.getReader() / TextDecoder
 *  - SSE line parsing ("data: ..." / "[DONE]")
 *  - rAF-throttled flush
 *  - final flush
 *  - cleanup / abort support
 *
 * No behavior change vs V1: the consumer still owns `messages` state and
 * decides how to render each delta. This hook is purely transport+parsing.
 */

export interface StreamErrorInfo {
  status?: number;
  message: string;
}

export interface StreamResponseOptions {
  url: string;
  body: Record<string, unknown>;
  /** Called once when the first non-empty delta arrives. */
  onFirstChunk?: () => void;
  /** Called on every flushed delta with the FULL accumulated text so far. */
  onDelta: (fullText: string) => void;
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
      onFirstChunk,
      onDelta,
      onComplete,
      onError,
    }: StreamResponseOptions): Promise<string | null> => {
      // Cancel any previous in-flight stream from this hook instance.
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

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken =
          session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          onError?.({
            status: resp.status,
            message: (errData as { error?: string }).error || "stream_http_error",
          });
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
            const result = processSseLine(line);
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

        // Final flush of any remaining bytes still in the decoder.
        textBuffer += decoder.decode();
        if (textBuffer.trim()) {
          const remainingLines = textBuffer.split("\n");
          for (const line of remainingLines) {
            if (!line) continue;
            const result = processSseLine(line);
            if (result === "done") break;
          }
        }

        // Guarantee the very last accumulated state reaches the consumer
        // before onComplete fires (in case rAF didn't run yet).
        if (assistantSoFar !== lastFlushed) {
          lastFlushed = assistantSoFar;
          onDelta(assistantSoFar);
        }

        onComplete?.(assistantSoFar);
        return assistantSoFar;
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") {
          // Silent abort — caller initiated cleanup.
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
