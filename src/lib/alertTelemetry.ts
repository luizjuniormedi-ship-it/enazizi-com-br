/**
 * alertTelemetry — camada de envio de eventos do Alert Orchestrator
 * ──────────────────────────────────────────────────────────────────
 * Insere eventos na tabela `alert_events` para análise posterior.
 *
 * Princípios:
 *   - NUNCA quebra UX: falhas de rede são capturadas silenciosamente
 *   - Fire-and-forget: não bloqueia render
 *   - Dedupe local de "exposed": cada par (alert_id, sessão) é registrado
 *     apenas 1 vez para não inflar a tabela com re-renders
 *   - Throttle de 1.5s para o mesmo alert_id (evita spam em re-renders)
 *
 * Uso:
 *   import { trackAlertEvent } from "@/lib/alertTelemetry";
 *   trackAlertEvent({ alert, eventType: "exposed" });
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AlertOrchestratorItem,
  AlertPriority,
  AlertLayer,
} from "@/types/alertOrchestrator";

export type AlertEventType =
  | "exposed"
  | "clicked"
  | "dismissed"
  | "suppressed"
  | "auto_hidden"
  | "expired"
  | "resolved";

export interface TrackAlertEventInput {
  alert: Pick<
    AlertOrchestratorItem,
    | "id"
    | "source"
    | "priority"
    | "layer"
    | "dedupeKey"
    | "suppressedBy"
    | "legacyOrigin"
    | "viaBridge"
    | "metadata"
  >;
  eventType: AlertEventType;
  /** Metadados extras opcionais (mesclados ao do alerta). */
  extra?: Record<string, unknown>;
}

// Cache local para deduplicação por sessão (evita re-fire em re-renders)
const SESSION_CACHE_KEY = "alert_orch_session_cache_v1";
const THROTTLE_MS = 1500;

interface SessionEntry {
  lastAt: number;
  types: Record<string, number>;
}

function readSessionCache(): Record<string, SessionEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SessionEntry>) : {};
  } catch {
    return {};
  }
}

function writeSessionCache(cache: Record<string, SessionEntry>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage cheio ou bloqueado — não-fatal
  }
}

/**
 * Verifica se devemos enviar este evento agora ou se ele é redundante.
 * - "exposed" do mesmo alert_id: 1× por sessão
 * - Outros tipos: throttle de 1.5s entre eventos idênticos
 */
function shouldEmit(alertId: string, eventType: AlertEventType): boolean {
  const cache = readSessionCache();
  const entry = cache[alertId];
  const now = Date.now();

  if (!entry) {
    cache[alertId] = { lastAt: now, types: { [eventType]: now } };
    writeSessionCache(cache);
    return true;
  }

  const lastSameType = entry.types[eventType];

  // "exposed" → 1× por sessão
  if (eventType === "exposed" && lastSameType) {
    return false;
  }

  // Throttle geral
  if (lastSameType && now - lastSameType < THROTTLE_MS) {
    return false;
  }

  entry.lastAt = now;
  entry.types[eventType] = now;
  cache[alertId] = entry;
  writeSessionCache(cache);
  return true;
}

/**
 * Registra um evento de alerta. Fire-and-forget, nunca lança.
 */
export function trackAlertEvent(input: TrackAlertEventInput): void {
  const { alert, eventType, extra } = input;

  if (!shouldEmit(alert.id, eventType)) return;

  // Executa async sem bloquear
  void (async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      // metadata precisa ser Json — serializamos para garantir compatibilidade
      const mergedMeta = { ...(alert.metadata ?? {}), ...(extra ?? {}) };
      const metadataJson = JSON.parse(JSON.stringify(mergedMeta));

      await supabase.from("alert_events").insert([
        {
          user_id: userId,
          alert_id: alert.id,
          source: String(alert.source),
          priority: alert.priority as AlertPriority,
          layer: alert.layer as AlertLayer,
          event_type: eventType,
          dedupe_key: alert.dedupeKey ?? null,
          suppressed_by: alert.suppressedBy ?? null,
          legacy_origin: alert.legacyOrigin ?? null,
          via_bridge: !!alert.viaBridge,
          metadata: metadataJson,
        },
      ]);
    } catch {
      // Silencioso — telemetria nunca pode quebrar UX
    }
  })();
}

/**
 * Helper para registrar exposição em lote (ex.: ao montar dashboard).
 */
export function trackAlertExposureBatch(
  alerts: ReadonlyArray<TrackAlertEventInput["alert"]>
): void {
  for (const a of alerts) {
    trackAlertEvent({ alert: a, eventType: "exposed" });
  }
}

/**
 * Helper para registrar supressões em lote.
 */
export function trackAlertSuppressionBatch(
  alerts: ReadonlyArray<TrackAlertEventInput["alert"]>
): void {
  for (const a of alerts) {
    if (!a.suppressedBy) continue;
    trackAlertEvent({ alert: a, eventType: "suppressed" });
  }
}
