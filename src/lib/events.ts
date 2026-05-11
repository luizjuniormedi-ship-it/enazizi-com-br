/**
 * ENAZIZI Pedagogical Event Bus
 * 
 * Standardized events for the adaptive learning engine.
 * Allows components (Planner, Tutor, Analytics, Gamification) to react
 * in real-time to user progress without direct coupling.
 */

export type PedagogicalEvent = 
  | 'question_answered'
  | 'fsrs_reviewed'
  | 'mission_completed'
  | 'weak_topic_detected'
  | 'recovery_started'
  | 'recovery_completed'
  | 'diagnostic_completed';

export interface EventPayloads {
  'question_answered': { questionId: string; correct: boolean; timeMs: number; topic?: string };
  'fsrs_reviewed': { cardId: string; rating: number; interval: number };
  'mission_completed': { missionId: string; xpGained: number };
  'weak_topic_detected': { topic: string; score: number };
  'recovery_started': { topic: string; source: 'error_bank' | 'failed_mission' };
  'recovery_completed': { topic: string; result: 'success' | 'partial' };
  'diagnostic_completed': { initialScore: number };
}

export const dispatchPedagogicalEvent = <T extends PedagogicalEvent>(
  event: T,
  payload: EventPayloads[T]
) => {
  if (typeof window === 'undefined') return;
  
  const customEvent = new CustomEvent(`ena:${event}`, {
    detail: payload,
    bubbles: true,
    cancelable: true
  });
  
  window.dispatchEvent(customEvent);
  
  if (import.meta.env.DEV) {
    console.debug(`[PedagogicalEvent] ${event}`, payload);
  }
};

export const usePedagogicalEventListener = <T extends PedagogicalEvent>(
  event: T,
  callback: (payload: EventPayloads[T]) => void
) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<EventPayloads[T]>;
    callback(customEvent.detail);
  };

  // We return clean-up functions for useEffect
  return {
    subscribe: () => window.addEventListener(`ena:${event}`, handler),
    unsubscribe: () => window.removeEventListener(`ena:${event}`, handler)
  };
};
