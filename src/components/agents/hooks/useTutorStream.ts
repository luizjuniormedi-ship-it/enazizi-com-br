import { useCallback, useRef, useState } from "react";
import { isTutorBlock, type TutorBlock } from "@/types/tutor";
import { callTutorV3 } from "@/lib/tutor/tutorClient";

/**
 * useTutorStream — Sprint 4 (dual mode)
 * Centralizado para usar o Cliente Oficial V3.
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
          }
          return "ok";
        } catch {
          return "incomplete";
        }
      };

      // ── BLOCKS MODE (NDJSON) ──────────────────────────────────────
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
            const mirror = parsed.type === "deep_dive" ? parsed.payload.markdown : `[${parsed.type}]`;
            appendAssistantChunk((assistantSoFar ? "\n\n" : "") + mirror);
          }
          return "ok";
        } catch {
          return "incomplete";
        }
      };

      const lineProcessor = format === "blocks" ? processBlockLine : processSseLine;

      try {
        // v14 CENTRALIZATION: Extract function name from URL if possible
        const functionName = url.split('/').pop() || "tutor-v3-premium";
        
        // Use the official Resilient Client
        const resp = await callTutorV3(body, {
          functionName,
          stream: true,
          signal: signal || controller.signal
        });

        if (!resp || !resp.body) throw new Error("No response body");

        const contentType = resp.headers.get("Content-Type") || "";
        const isJson = contentType.includes("application/json");

        if (isJson) {
          const data = await resp.json();
          const content = data.content || data.message || data.answer || data.response || "";

          if (!content && data.ok === false) {
            onError?.({ status: resp.status, message: data.message || "Erro na resposta da IA" });
            return null;
          }

          onFirstChunk?.();
          onDelta(content);
          onComplete?.(content);
          setIsStreaming(false);
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
      } catch (e: any) {
        if (e.name === "AbortError") {
          return assistantSoFar ? { content: assistantSoFar } : null;
        }
        console.error("[useTutorStream] error:", e);
        
        onError?.({
          message: e.message || "Erro de conexão com o Tutor",
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
