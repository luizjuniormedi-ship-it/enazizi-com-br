import { useState, useCallback, useRef, useEffect } from "react";
import { emitShadowEvent, logShadowOutcome } from "@/lib/shadowAdaptive";
import { dispatchPedagogicalEvent } from "@/lib/events";

export interface StudySessionMetrics {
  active: boolean;
  startedAt: number;
  durationSeconds: number;
  tasksCompleted: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpGained: number;
  themesTouched: Set<string>;
  source: string;
}

export interface StudySessionSummary {
  durationSeconds: number;
  tasksCompleted: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpGained: number;
  themesTouched: string[];
  source: string;
}

const SESSION_KEY = "enazizi_study_session";

function loadSession(): Partial<StudySessionMetrics> | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, themesTouched: new Set(parsed.themesTouched || []) };
  } catch { return null; }
}

function saveSession(m: StudySessionMetrics) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      ...m,
      themesTouched: Array.from(m.themesTouched),
    }));
  } catch {}
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

export function useStudySession() {
  const [metrics, setMetrics] = useState<StudySessionMetrics>(() => {
    const saved = loadSession();
    if (saved?.active) {
      return {
        active: true,
        startedAt: saved.startedAt || Date.now(),
        durationSeconds: saved.durationSeconds || 0,
        tasksCompleted: saved.tasksCompleted || 0,
        correctAnswers: saved.correctAnswers || 0,
        wrongAnswers: saved.wrongAnswers || 0,
        xpGained: saved.xpGained || 0,
        themesTouched: saved.themesTouched instanceof Set ? saved.themesTouched : new Set(),
        source: saved.source || "manual",
      };
    }
    return {
      active: false,
      startedAt: 0,
      durationSeconds: 0,
      tasksCompleted: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      xpGained: 0,
      themesTouched: new Set<string>(),
      source: "manual",
    };
  });

  const [summary, setSummary] = useState<StudySessionSummary | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Tick elapsed time
  useEffect(() => {
    if (!metrics.active) return;
    timerRef.current = setInterval(() => {
      setMetrics(prev => {
        const updated = { ...prev, durationSeconds: Math.round((Date.now() - prev.startedAt) / 1000) };
        saveSession(updated);
        return updated;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [metrics.active]);

  const startSession = useCallback((source = "manual") => {
    const m: StudySessionMetrics = {
      active: true,
      startedAt: Date.now(),
      durationSeconds: 0,
      tasksCompleted: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      xpGained: 0,
      themesTouched: new Set(),
      source,
    };
    setMetrics(m);
    setSummary(null);
    saveSession(m);
    // Shadow Adaptive Layer (Fase 3A) — observacional.
    void emitShadowEvent({ module: "simulado", event: "simulation_started", extra: { source } });
  }, []);

  const recordAction = useCallback((correct: boolean, theme?: string, xp = 0) => {
    setMetrics(prev => {
      const themesTouched = new Set(prev.themesTouched);
      const isNewTheme = theme && !themesTouched.has(theme);
      
      if (theme) themesTouched.add(theme);

      const updated: StudySessionMetrics = {
        ...prev,
        tasksCompleted: prev.tasksCompleted + 1,
        correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
        wrongAnswers: prev.wrongAnswers + (correct ? 0 : 1),
        xpGained: prev.xpGained + xp,
        themesTouched,
      };
      saveSession(updated);
      
      // Telemetry: [ENAMED_THEME_SELECTED]
      if (isNewTheme && theme) {
        import("@/lib/safeTelemetry").then(({ emitSafeEvent }) => {
          emitSafeEvent("ENAMED_THEME_SELECTED", { theme });
        });
      }

      // Emit standardized pedagogical event
      dispatchPedagogicalEvent('question_answered', {
        questionId: 'session_task',
        correct,
        timeMs: 0, 
        topic: theme
      });
      
      return updated;
    });
  }, []);

  const endSession = useCallback(() => {
    setMetrics(prev => {
      const s: StudySessionSummary = {
        durationSeconds: Math.round((Date.now() - prev.startedAt) / 1000),
        tasksCompleted: prev.tasksCompleted,
        correctAnswers: prev.correctAnswers,
        wrongAnswers: prev.wrongAnswers,
        xpGained: prev.xpGained,
        themesTouched: Array.from(prev.themesTouched),
        source: prev.source,
      };
      setSummary(s);
      clearSession();
      // Shadow Adaptive Layer (Fase 3A) — observacional.
      void emitShadowEvent({
        module: "simulado",
        event: "simulation_finished",
        durationMs: s.durationSeconds * 1000,
        extra: { tasks: s.tasksCompleted, correct: s.correctAnswers, wrong: s.wrongAnswers },
      });
      void logShadowOutcome({
        module: "simulado",
        action: "completed",
        durationMs: s.durationSeconds * 1000,
        extra: { tasks: s.tasksCompleted },
      });

      // Emit standardized pedagogical event
      dispatchPedagogicalEvent('mission_completed', {
        missionId: s.source,
        xpGained: s.xpGained
      });

      return { ...prev, active: false };
    });
  }, []);

  const dismissSummary = useCallback(() => setSummary(null), []);

  return { metrics, summary, startSession, recordAction, endSession, dismissSummary };
}
