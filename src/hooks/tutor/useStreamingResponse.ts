import { useRef, useCallback } from "react";
import type { Msg } from "@/components/tutor/TutorConstants";
import { supabase } from "@/integrations/supabase/client";
import { emitShadowEvent } from "@/lib/shadowAdaptive";
import { auditTutorResponse } from "@/utils/pedagogicalAudit";

interface StreamOptions {
  url: string;
  body: Record<string, unknown>;
  onChunk: (fullText: string, data?: any) => void;
  onComplete: (fullText: string, data?: any) => void;
  onError: (error: string) => void;
}

export function useStreamingResponse() {
  const accumulatorRef = useRef("");

  const streamResponse = useCallback(async ({ url, body, onChunk, onComplete, onError }: StreamOptions) => {
    accumulatorRef.current = "";
    // Shadow Adaptive Layer (Fase 3A) — observacional. NÃO altera o Tutor.
    void emitShadowEvent({
      module: "tutor",
      event: "tutor_session_started",
      topic: (body as any)?.topic ?? null,
    });

    // === rAF-based flush throttle: at most 1 React render per frame (~60Hz) ===
    let pendingFlush = false;
    let lastFlushed = "";
    let lastData: any = null;

    const flushNow = () => {
      pendingFlush = false;
      const current = accumulatorRef.current;
      if (current === lastFlushed && lastData === null) return;
      lastFlushed = current;
      onChunk(current, lastData);
      lastData = null; // Limpa para o próximo flush
    };
    const scheduleFlush = () => {
      if (pendingFlush) return;
      pendingFlush = true;
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(flushNow);
      } else {
        setTimeout(flushNow, 16);
      }
    };

    const appendChunk = (content: string, data?: any) => {
      if (!content && !data) return;
      if (content) accumulatorRef.current += content;
      if (data) lastData = data;
      scheduleFlush();
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
        // Capturar dados extras do SSE (como context/bibliography)
        appendChunk(content || "", parsed);
        return "ok";
      } catch {
        return "incomplete";
      }
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const contentType = resp.headers.get("Content-Type") || "";
      if (!resp.ok || !contentType.includes("text/event-stream")) {
        const errData = await resp.json().catch(() => ({}));
        console.error("[useStreamingResponse] Response error or non-stream received:", { ok: resp.ok, contentType, errData });
        onError(errData.message || errData.error || "Erro ao conectar com o Tutor IA.");
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
          if (result === "done") { streamDone = true; break; }
          if (result === "incomplete") { textBuffer = `${line}\n${textBuffer}`; break; }
        }
      }

      // Final flush
      textBuffer += decoder.decode();
      if (textBuffer.trim()) {
        const remainingLines = textBuffer.split("\n");
        for (const line of remainingLines) {
          if (!line) continue;
          const result = processSseLine(line);
          if (result === "done") break;
        }
      }

      // Guarantee final state is delivered to UI before onComplete
      if (accumulatorRef.current !== lastFlushed || lastData !== null) {
        lastFlushed = accumulatorRef.current;
        onChunk(accumulatorRef.current, lastData);
      }

      const finalText = accumulatorRef.current;
      onComplete(finalText, lastData);
      return finalText;
    } catch (e) {
      console.error(e);
      onError("Falha ao conectar com o ChatGPT.");
      return null;
    }
  }, []);

  return { streamResponse, accumulatorRef };
}
