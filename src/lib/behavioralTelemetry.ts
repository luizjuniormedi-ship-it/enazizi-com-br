/**
 * Sprint 4 — Behavioral Telemetry (fire-and-forget)
 *
 * Mede tempo entre login/app-open e a primeira ação pedagógica real.
 * Zero impacto em UX. Falhas silenciosas.
 *
 * Conceitos:
 * - session_start: marcado por useTimeToAction quando o app monta com user logado.
 *   Persistido em sessionStorage (sobrevive a navegação SPA, NÃO a fechar a aba).
 * - first_meaningful_action: registrado UMA vez por sessão-aba ao primeiro CTA real.
 * - study_action_started: pode ser registrado em ações subsequentes (sem dedupe).
 * - pre_action_clicks / pre_action_route_changes: contadores incrementados pelo hook.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_START_KEY = "enazizi_session_start_ts";
const FIRST_ACTION_FIRED_KEY = "enazizi_first_action_fired";
const PRE_ACTION_CLICKS_KEY = "enazizi_pre_action_clicks";
const PRE_ACTION_ROUTES_KEY = "enazizi_pre_action_routes";

export type EntryPoint =
  | "visao_geral"
  | "estudar"
  | "enaflix"
  | "ia"
  | "bottom_nav"
  | "sidebar"
  | "mission_resume"
  | "other";

export type ActionKind =
  | "start_mission"
  | "resume_mission"
  | "start_topic"
  | "start_review"
  | "start_simulado"
  | "open_errors"
  | "open_flashcards"
  | "open_tutor"
  | "continue_session";

export type BehavioralEventType =
  | "session_start"
  | "first_meaningful_action"
  | "study_action_started"
  | "pre_action_navigation"
  | "study_entry_point";

interface TrackParams {
  userId: string;
  eventType: BehavioralEventType;
  entryPoint?: EntryPoint;
  actionKind?: ActionKind;
  route?: string;
  metadata?: Record<string, unknown>;
}

function getViewport(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 640 ? "mobile" : "desktop";
}

function getSessionStart(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const v = sessionStorage.getItem(SESSION_START_KEY);
  return v ? parseInt(v, 10) : null;
}

/** Marca início da sessão-aba (idempotente). Chamado pelo useTimeToAction. */
export function markSessionStart(): void {
  if (typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem(SESSION_START_KEY)) return;
  sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
  sessionStorage.setItem(PRE_ACTION_CLICKS_KEY, "0");
  sessionStorage.setItem(PRE_ACTION_ROUTES_KEY, "0");
}

/** Incremento leve para hesitação. */
export function incrementPreActionClicks(): void {
  if (typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem(FIRST_ACTION_FIRED_KEY)) return;
  const cur = parseInt(sessionStorage.getItem(PRE_ACTION_CLICKS_KEY) || "0", 10);
  sessionStorage.setItem(PRE_ACTION_CLICKS_KEY, String(cur + 1));
}

export function incrementPreActionRouteChanges(): void {
  if (typeof sessionStorage === "undefined") return;
  if (sessionStorage.getItem(FIRST_ACTION_FIRED_KEY)) return;
  const cur = parseInt(sessionStorage.getItem(PRE_ACTION_ROUTES_KEY) || "0", 10);
  sessionStorage.setItem(PRE_ACTION_ROUTES_KEY, String(cur + 1));
}

function readPreActionCounters() {
  if (typeof sessionStorage === "undefined") return { clicks: 0, routes: 0 };
  return {
    clicks: parseInt(sessionStorage.getItem(PRE_ACTION_CLICKS_KEY) || "0", 10),
    routes: parseInt(sessionStorage.getItem(PRE_ACTION_ROUTES_KEY) || "0", 10),
  };
}

/**
 * Registra um evento de telemetria comportamental.
 * Fire-and-forget — nunca lança, nunca bloqueia.
 *
 * Para event_type = 'first_meaningful_action', faz dedupe por sessão-aba.
 */
export function trackBehavioralEvent(params: TrackParams): void {
  try {
    const { userId, eventType, entryPoint, actionKind, route, metadata } = params;
    if (!userId) return;

    // Dedupe da primeira ação por sessão-aba
    if (eventType === "first_meaningful_action") {
      if (typeof sessionStorage !== "undefined") {
        if (sessionStorage.getItem(FIRST_ACTION_FIRED_KEY)) return;
        sessionStorage.setItem(FIRST_ACTION_FIRED_KEY, "1");
      }
    }

    const start = getSessionStart();
    const ms = start ? Date.now() - start : null;
    const counters = readPreActionCounters();

    void supabase
      .from("behavioral_telemetry" as any)
      .insert({
        user_id: userId,
        event_type: eventType,
        entry_point: entryPoint || null,
        action_kind: actionKind || null,
        route: route || (typeof window !== "undefined" ? window.location.pathname : null),
        viewport: getViewport(),
        ms_since_session_start: ms,
        pre_action_clicks: counters.clicks,
        pre_action_route_changes: counters.routes,
        metadata: (metadata || {}) as any,
      } as any)
      .then(({ error }) => {
        if (error) console.warn("[BehavioralTelemetry] insert failed:", error.message);
      });
  } catch (e) {
    // silencioso — telemetria nunca quebra UX
    console.warn("[BehavioralTelemetry] caught:", e);
  }
}

/**
 * Atalho conveniente: marca uma ação real de estudo.
 * Sempre dispara `study_action_started`. Se ainda não houve primeira ação,
 * dispara também `first_meaningful_action`.
 */
export function trackStudyAction(
  userId: string,
  entryPoint: EntryPoint,
  actionKind: ActionKind,
  metadata?: Record<string, unknown>,
): void {
  // Dispara first_meaningful_action ANTES (para preservar ms/clicks daquele instante)
  trackBehavioralEvent({
    userId,
    eventType: "first_meaningful_action",
    entryPoint,
    actionKind,
    metadata,
  });
  // E também o evento contínuo de ação iniciada
  trackBehavioralEvent({
    userId,
    eventType: "study_action_started",
    entryPoint,
    actionKind,
    metadata,
  });
}
