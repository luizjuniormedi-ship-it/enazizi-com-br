import { useRef, useCallback } from "react";
import type { Msg } from "@/components/tutor/TutorConstants";
import { supabase } from "@/integrations/supabase/client";

interface StreamOptions {
  url: string;
  body: Record<string, unknown>;
  onChunk: (fullText: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export function useStreamingResponse() {
  const accumulatorRef = useRef("");

  const streamResponse = useCallback(async ({ url, body, onChunk, onComplete, onError }: StreamOptions) => {
    accumulatorRef.current = "";

    const appendChunk = (content: string) => {
      if (!content) return;
      accumulatorRef.current += content;
      onChunk(accumulatorRef.current);
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
        if (content) appendChunk(content);
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

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        onError(errData.error || "Erro ao conectar com o ChatGPT");
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

      const finalText = accumulatorRef.current;
      onComplete(finalText);
      return finalText;
    } catch (e) {
      console.error(e);
      onError("Falha ao conectar com o ChatGPT.");
      return null;
    }
  }, []);

  return { streamResponse, accumulatorRef };
}
