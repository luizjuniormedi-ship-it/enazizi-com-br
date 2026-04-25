import { supabase } from "@/integrations/supabase/client";
// Using crypto.randomUUID() instead of uuid package to avoid dependency issues
const genUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Pedagogical Telemetry System
 * Optimized for performance with batching and offline resilience.
 */

export type TelemetryEventName =
  // Dashboard / navegação
  | 'dashboard_opened'
  | 'hero_cta_clicked'
  | 'continuar_clicked'
  | 'revisoes_clicked'
  | 'tutor_continue_clicked'
  | 'analytics_opened'
  // Sessão de estudo
  | 'study_session_started'
  | 'first_question_loaded'
  | 'first_answer_submitted'
  | 'study_session_abandoned'
  | 'study_session_completed'
  // Fricção & comportamento
  | 'rage_click_detected'
  | 'repeated_navigation'
  | 'idle_dashboard'
  | 'exited_before_question'
  // Retenção
  | 'returned_same_day'
  | 'returned_next_day'
  | 'streak_recovered'
  // Tutor IA — qualidade (Fase 2)
  | 'tutor_opened'
  | 'tutor_message_sent'
  | 'tutor_response_received'
  | 'tutor_response_regenerated'
  | 'tutor_memory_reused'
  | 'tutor_quiz_answered'
  | 'tutor_helpful_clicked'
  | 'tutor_unhelpful_clicked'
  | 'tutor_abandoned_after_response';

interface TelemetryProperties {
  [key: string]: any;
  pending_reviews?: number;
  active_exam?: string | null;
  current_mode?: string;
  time_since_last_action?: number;
  duration?: number;
}

class TelemetryService {
  private static instance: TelemetryService;
  private sessionId: string;
  private eventQueue: any[] = [];
  private batchSize = 5;
  private flushInterval = 10000; // 10 seconds
  private lastActionTimestamp: number = Date.now();
  private isProcessing = false;

  private constructor() {
    this.sessionId = genUUID();
    this.setupListeners();
    this.startAutoFlush();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    // Detect rage clicks
    let clickCount = 0;
    let lastClickTime = 0;
    window.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastClickTime < 300) {
        clickCount++;
        if (clickCount > 4) {
          this.track('rage_click_detected', { count: clickCount });
          clickCount = 0;
        }
      } else {
        clickCount = 1;
      }
      lastClickTime = now;
      this.lastActionTimestamp = now;
    });

    // Detect Idle (fires AT MOST once per idle stretch — resets when user acts again)
    let idleFiredForThisStretch = false;
    setInterval(() => {
      const idleTime = Date.now() - this.lastActionTimestamp;
      const onDashboard = window.location.pathname.includes('dashboard');
      if (idleTime > 60000 && onDashboard && !idleFiredForThisStretch) {
        this.track('idle_dashboard', { idle_duration_ms: idleTime });
        idleFiredForThisStretch = true;
      } else if (idleTime < 60000 && idleFiredForThisStretch) {
        // user acted again — re-arm
        idleFiredForThisStretch = false;
      }
    }, 60000);
  }

  private startAutoFlush() {
    setInterval(() => this.flush(), this.flushInterval);
  }

  public async track(eventName: TelemetryEventName, properties: TelemetryProperties = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const event = {
      user_id: user.id,
      session_id: this.sessionId,
      event_name: eventName,
      properties: {
        ...properties,
        time_to_first_action: properties.time_to_first_action || (Date.now() - performance.timing.navigationStart)
      },
      route: window.location.pathname,
      device_type: this.getDeviceType(),
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString()
    };

    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush() {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;
    const batch = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await supabase.from('telemetry_events').insert(batch);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to flush telemetry batch', err);
      // Put back in queue if failed (offline resilience)
      this.eventQueue = [...batch, ...this.eventQueue];
    } finally {
      this.isProcessing = false;
    }
  }

  private getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "mobile";
    return "desktop";
  }
}

export const telemetry = TelemetryService.getInstance();
