/**
 * useTutorDrawer — F4
 *
 * Lightweight global event-bus to open the contextual Tutor drawer from
 * anywhere (Cockpit, StudyLoop, Mnemonics, etc.) without prop drilling.
 *
 * Mount <TutorDrawer /> once in the dashboard tree. Anyone can call
 * `openTutorDrawer({ topic, reason, ... })` to surface it with context.
 */
import { useEffect, useState, useCallback } from "react";

export interface TutorDrawerContext {
  topic?: string;
  subtopic?: string;
  specialty?: string;
  reason?: string;
  /** Opening phase hint (correction, deepen, mnemonic_assist, etc.) */
  tutorPhase?: string;
  /** Optional pre-filled first message to send on open */
  initialPrompt?: string;
  /** Source module that triggered the drawer (for telemetry) */
  source?: string;
  /** P0 — orchestrator decision id, so the drawer can close the adaptive loop */
  decisionId?: string;
}

const EVENT_OPEN = "enazizi:tutor-drawer:open";
const EVENT_CLOSE = "enazizi:tutor-drawer:close";

export function openTutorDrawer(ctx: TutorDrawerContext = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorDrawerContext>(EVENT_OPEN, { detail: ctx }));
}

export function closeTutorDrawer() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_CLOSE));
}

/** Subscribes to open/close events. Use inside the drawer container. */
export function useTutorDrawer() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<TutorDrawerContext | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<TutorDrawerContext>).detail ?? {};
      setContext(detail);
      setOpen(true);
    };
    const onClose = () => setOpen(false);
    window.addEventListener(EVENT_OPEN, onOpen as EventListener);
    window.addEventListener(EVENT_CLOSE, onClose);
    return () => {
      window.removeEventListener(EVENT_OPEN, onOpen as EventListener);
      window.removeEventListener(EVENT_CLOSE, onClose);
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);
  return { open, context, close, setOpen };
}
