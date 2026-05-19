import { supabase } from "@/integrations/supabase/client";

/**
 * Pedagogical Telemetry System v2
 * - Cache de user/session (sem await por evento)
 * - Flush em beforeunload/visibilitychange (sendBeacon-style via fetch keepalive)
 * - Persistência localStorage (resiliência a refresh/crash)
 * - Watchdog do isProcessing
 * - Limite de fila para não vazar memória
 */

const genUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const STORAGE_KEY = 'enazizi_telemetry_queue_v1';
const MAX_QUEUE = 500;

export type TelemetryEventName =
  | 'dashboard_opened'
  | 'hero_cta_clicked'
  | 'continuar_clicked'
  | 'revisoes_clicked'
  | 'tutor_continue_clicked'
  | 'analytics_opened'
  | 'study_session_started'
  | 'first_question_loaded'
  | 'first_answer_submitted'
  | 'study_session_abandoned'
  | 'study_session_completed'
  | 'rage_click_detected'
  | 'repeated_navigation'
  | 'idle_dashboard'
  | 'exited_before_question'
  | 'returned_same_day'
  | 'returned_next_day'
  | 'streak_recovered'
  | 'tutor_opened'
  | 'tutor_message_sent'
  | 'tutor_response_received'
  | 'tutor_response_regenerated'
  | 'tutor_memory_reused'
  | 'tutor_quiz_answered'
  | 'tutor_helpful_clicked'
  | 'tutor_unhelpful_clicked'
  | 'tutor_abandoned_after_response'
  | 'profile_exam_target_updated'
  | 'study_plan_reset_requested'
  | 'study_plan_reset_completed'
  | 'study_plan_reset_failed'
  // Module entry/exit instrumentation (Fase A baseline)
  | 'plantao_opened'
  | 'plantao_completed'
  | 'anamnese_opened'
  | 'anamnese_completed'
  | 'simulado_opened'
  | 'simulado_completed'
  | 'flashcard_opened'
  | 'flashcard_completed'
  | 'mnemonic_opened'
  | 'practical_exam_opened'
  | 'practical_exam_completed'
  // Phase Enterprise+ (Neuroanalytics)
  | 'cme_playback_started'
  | 'cme_segment_completed'
  | 'cme_playback_speed_changed'
  | 'cme_fatigue_detected'
  | 'cme_overload_alert'
  | 'cme_knowledge_mesh_viewed'
  | 'cme_batch_generation_started'
  | 'cme_batch_generation_completed'
  // Fase 8: Enterprise Observability
  | 'session_started'
  | 'session_progress'
  | 'session_paused'
  | 'session_abandoned'
  | 'session_completed'
  | 'edge_function_latency'
  | 'supabase_timeout'
  | 'ia_pedagogical_score'
  | 'ia_fallback_used'
  // Event Bus Pedagógico (Fase Pós-Go-Live)
  | 'question_answered'
  | 'fsrs_reviewed'
  | 'mission_completed'
  | 'weak_topic_detected'
  | 'recovery_started'
  | 'recovery_completed'
  | 'tutor_error_detected'
  // Enterprise Operations (Fase V)
  | 'runtime_error'
  | 'unhandled_promise'
  | 'chunk_load_failed'
  | 'navigation_error'
  | 'performance_vitals'
  | 'offline_transition'
  | 'online_transition'
  | 'hydration_mismatch'
  | 'memory_pressure'
  | 'cognitive_decision_created'
  | 'mnemonic_generated'
  | 'mnemonic_saved'
  | 'mnemonic_rejected'
  | 'mnemonic_used_in_flashcard'
  | 'mnemonic_used_in_tutor'
  | 'mnemonic_reviewed'
  | 'mnemonic_failed_recall'
  | 'mnemonic_optimized'
  | 'mnemonic_visual_expanded'
  | 'sidebar_navigation_clicked'
  | 'planner_opened'
  | 'metrics_opened'
  | 'progress_opened'
  | 'library_opened'
  | 'navigation_error'
  | 'route_load_failed';


interface TelemetryProperties {
  [key: string]: any;
}

class TelemetryService {
  private static instance: TelemetryService;
  private sessionId: string;
  private eventQueue: any[] = [];
  private batchSize = 5;
  private flushInterval = 8000;
  private lastActionTimestamp: number = Date.now();
  private isProcessing = false;
  private processingStartedAt = 0;
  private cachedUserId: string | null = null;
  private userPromise: Promise<string | null> | null = null;
  private navStart: number = typeof performance !== 'undefined' ? performance.now() : Date.now();

  private constructor() {
    this.sessionId = genUUID();
    this.hydrateFromStorage();
    this.bootstrapUser();
    this.setupListeners();
    this.startAutoFlush();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.eventQueue = arr.slice(-MAX_QUEUE);
      }
    } catch {}
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.eventQueue.slice(-MAX_QUEUE)));
    } catch {}
  }

  private async bootstrapUser() {
    try {
      const { data } = await supabase.auth.getUser();
      this.cachedUserId = data.user?.id ?? null;
    } catch {
      this.cachedUserId = null;
    }
    supabase.auth.onAuthStateChange((_evt, session) => {
      this.cachedUserId = session?.user?.id ?? null;
      if (this.cachedUserId) this.flush();
    });
  }

  private async ensureUser(): Promise<string | null> {
    if (this.cachedUserId) return this.cachedUserId;
    if (!this.userPromise) {
      this.userPromise = supabase.auth.getUser().then(({ data }) => {
        this.cachedUserId = data.user?.id ?? null;
        return this.cachedUserId;
      }).catch(() => null).finally(() => { this.userPromise = null; });
    }
    return this.userPromise;
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    // Phase V: Enterprise Runtime Error Tracking
    window.addEventListener('error', (event) => {
      this.track('runtime_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('unhandled_promise', {
        reason: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      });
    });

    // Network Status
    window.addEventListener('online', () => this.track('online_transition'));
    window.addEventListener('offline', () => this.track('offline_transition'));

    // Performance Vitals (FCP, LCP, CLS, FID)
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.track('performance_vitals', { type: 'FCP', value: Math.round(entry.startTime) });
            }
          });
        });
        paintObserver.observe({ type: 'paint', buffered: true });

        const navigationObserver = new PerformanceObserver((list) => {
          const nav = list.getEntries()[0] as PerformanceNavigationTiming;
          if (nav) {
            this.track('performance_vitals', {
              type: 'navigation',
              dom_ready: Math.round(nav.domContentLoadedEventEnd),
              load_complete: Math.round(nav.loadEventEnd),
              ttfb: Math.round(nav.responseStart)
            });
          }
        });
        navigationObserver.observe({ type: 'navigation', buffered: true });
      } catch (err) {
        console.warn('[telemetry] PerformanceObserver failed', err);
      }
    }

    // Existing listeners...

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
    }, { passive: true });

    let idleFiredForThisStretch = false;
    setInterval(() => {
      const idleTime = Date.now() - this.lastActionTimestamp;
      const onDashboard = window.location.pathname.includes('dashboard');
      if (idleTime > 60000 && onDashboard && !idleFiredForThisStretch) {
        this.track('idle_dashboard', { idle_duration_ms: idleTime });
        idleFiredForThisStretch = true;
      } else if (idleTime < 60000 && idleFiredForThisStretch) {
        idleFiredForThisStretch = false;
      }
    }, 60000);

    // Flush on tab hide / page unload — crítico para não perder eventos
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
    window.addEventListener('pagehide', () => this.flush(true));
    window.addEventListener('beforeunload', () => this.flush(true));
  }

  private startAutoFlush() {
    setInterval(() => {
      // Watchdog: destrava se uma flush ficou pendurada > 30s
      if (this.isProcessing && Date.now() - this.processingStartedAt > 30000) {
        this.isProcessing = false;
      }
      this.flush();
    }, this.flushInterval);
  }

  public async track(eventName: TelemetryEventName, properties: TelemetryProperties = {}) {
    // 10% sampling for high-frequency events to save DB throughput
    const highFreqEvents: TelemetryEventName[] = ['performance_vitals', 'scroll_depth' as any, 'idle_dashboard', 'tutor_message_sent'];
    if (highFreqEvents.includes(eventName) && Math.random() > 0.1) {
      return;
    }

    try {
      const userId = await this.ensureUser();
      if (!userId) return; // sem usuário, não há como satisfazer RLS

      const event = {
        user_id: userId,
        session_id: this.sessionId,
        event_name: eventName,
        properties: {
          ...properties,
          time_to_first_action: properties.time_to_first_action ?? Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.navStart),
          time_to_first_block: properties.time_to_first_block ?? null,
        },
        route: properties.route ?? (typeof window !== 'undefined' ? window.location.pathname : null),
        device_type: this.getDeviceType(),
        screen_size: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        scroll_depth: properties.scroll_depth ?? (typeof window !== 'undefined' ? Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100) : null),
        timestamp: new Date().toISOString(),
      };

      this.eventQueue.push(event);
      if (this.eventQueue.length > MAX_QUEUE) {
        this.eventQueue = this.eventQueue.slice(-MAX_QUEUE);
      }
      this.persist();

      if (this.eventQueue.length >= this.batchSize) {
        this.flush();
      }
    } catch (err) {
      console.warn('[telemetry] track failed', eventName, err);
    }
  }

  private async flush(isFinal: boolean = false) {
    if (this.eventQueue.length === 0) return;
    if (this.isProcessing && !isFinal) return;

    this.isProcessing = true;
    this.processingStartedAt = Date.now();
    const batch = [...this.eventQueue];
    this.eventQueue = [];
    this.persist();

    try {
      const { error } = await supabase.from('telemetry_events').insert(batch);
      if (error) throw error;
    } catch (err) {
      console.warn('[telemetry] flush failed, requeueing', err);
      this.eventQueue = [...batch, ...this.eventQueue].slice(-MAX_QUEUE);
      this.persist();
    } finally {
      this.isProcessing = false;
    }
  }

  public getSessionId() { return this.sessionId; }
  public getQueueSize() { return this.eventQueue.length; }

  private getDeviceType() {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "mobile";
    return "desktop";
  }
}

export const telemetry = TelemetryService.getInstance();
