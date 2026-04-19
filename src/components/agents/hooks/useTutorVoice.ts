import { useState, useRef, useEffect, useCallback } from "react";
import type * as React from "react";
import type { Msg } from "../agentChatTypes";

const AUTO_SPEAK_LS_KEY = "tutor_auto_speak";

type SetInput = React.Dispatch<React.SetStateAction<string>>;

interface UseTutorVoiceOptions {
  messages: Msg[];
  isLoading: boolean;
  setInput: SetInput;
}

/**
 * useTutorVoice
 * Owns: STT (SpeechRecognition), TTS (speechSynthesis), autoSpeak (with optional
 * localStorage persistence — non-breaking; defaults to false if absent).
 *
 * Behavior is preserved 1:1 from the previous monolithic useAgentChat.
 */
export function useTutorVoice({ messages, isLoading, setInput }: UseTutorVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [autoSpeak, setAutoSpeakState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(AUTO_SPEAK_LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const recognitionRef = useRef<any>(null);
  const lastMsgRef = useRef<number>(0);

  const setAutoSpeak = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setAutoSpeakState((prev) => {
      const next = typeof value === "function" ? (value as (p: boolean) => boolean)(prev) : value;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(AUTO_SPEAK_LS_KEY, next ? "1" : "0");
        }
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const hasSpeechRecognition =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }
      setInput(finalTranscript + interim);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, setInput]);

  const speakText = useCallback(
    (text: string, msgIdx: number) => {
      if (speakingMsgIdx === msgIdx) {
        window.speechSynthesis.cancel();
        setSpeakingMsgIdx(null);
        return;
      }
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[#*_`~>\[\]()!|]/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, " ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "pt-BR";
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice =
        voices.find((v) => v.lang.startsWith("pt-BR")) || voices.find((v) => v.lang.startsWith("pt"));
      if (ptVoice) utterance.voice = ptVoice;
      utterance.onend = () => setSpeakingMsgIdx(null);
      utterance.onerror = () => setSpeakingMsgIdx(null);
      setSpeakingMsgIdx(msgIdx);
      window.speechSynthesis.speak(utterance);
    },
    [speakingMsgIdx]
  );

  // Auto-speak when a new assistant message arrives
  useEffect(() => {
    if (!autoSpeak || !hasSpeechSynthesis) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (
      lastMsg?.role === "assistant" &&
      lastIdx > lastMsgRef.current &&
      !isLoading &&
      lastIdx > 0
    ) {
      lastMsgRef.current = lastIdx;
      speakText(lastMsg.content, lastIdx);
    }
  }, [messages, isLoading, autoSpeak, hasSpeechSynthesis, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    // State
    isListening,
    speakingMsgIdx,
    autoSpeak,
    // Setters
    setAutoSpeak,
    // Handlers
    toggleListening,
    speakText,
    // Capabilities
    hasSpeechRecognition,
    hasSpeechSynthesis,
  };
}
